// js/restaurants.js  (non-module version — works with config.js that sets window.ORS_API_KEY)
let map;
// Default Surat center (simulate user location) [lat, lng]
const userLocation = [21.1702, 72.8311];

function showMessage(msg) {
    console.warn("User Alert:", msg);
    // You can also print to UI if desired
}

function initRestaurantMap() {
    map = L.map('map').setView(userLocation, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    L.marker(userLocation).addTo(map)
        .bindPopup("Your Location (Simulated)").openPopup();

    loadNearbyRestaurants(userLocation);
}

const OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
];

async function fetchFromOverpass(query) {
    // If running in production on Vercel, route through our serverless proxy to bypass CORS/Origin blocks!
    const isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (!isLocal) {
        try {
            console.log("Production detected. Routing request through Vercel Serverless Proxy...");
            const response = await fetch("/api/overpass", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: "data=" + encodeURIComponent(query)
            });
            if (response.ok) {
                const data = await response.json();
                if (data && data.elements) {
                    console.log("Successfully fetched from Vercel Serverless Proxy!");
                    return data;
                }
            } else {
                console.warn(`Vercel Proxy returned status: ${response.status}`);
            }
        } catch (e) {
            console.warn("Vercel Proxy failed, falling back to direct public mirrors:", e);
        }
    }

    // Local development or proxy fallback: query direct public mirrors
    for (const url of OVERPASS_MIRRORS) {
        try {
            console.log(`Attempting direct fetch from Overpass mirror: ${url}`);
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: "data=" + encodeURIComponent(query)
            });
            if (response.ok) {
                const data = await response.json();
                if (data && data.elements) {
                    console.log(`Successfully fetched directly from: ${url}`);
                    return data;
                }
            } else {
                console.warn(`Mirror ${url} returned status: ${response.status}`);
            }
        } catch (e) {
            console.warn(`Failed to fetch from mirror ${url}:`, e);
        }
    }
    throw new Error("All Overpass API mirrors and proxy failed to respond.");
}

async function loadNearbyRestaurants(center) {
    showMessage("Step 1: Searching for restaurants in the area...");
    const [lat, lng] = center;
    const bbox = [lat - 0.08, lng - 0.08, lat + 0.08, lng + 0.08];

    const query = `
        [out:json][timeout:25];
        (
          node["amenity"="restaurant"](${bbox.join(',')});
          way["amenity"="restaurant"](${bbox.join(',')});
          relation["amenity"="restaurant"](${bbox.join(',')});
        );
        out center;
    `;
    try {
        const data = await fetchFromOverpass(query);

        const restaurants = data.elements
            .filter(el => (el.lat || el.center?.lat) && (el.lon || el.center?.lon))
            .map(el => ({
                name: el.tags?.name || "Restaurant",
                lat: el.lat || el.center?.lat,
                lng: el.lon || el.center?.lon,
                coords: [el.lon || el.center?.lon, el.lat || el.center?.lat] // [lng, lat]
            }));

        if (restaurants.length === 0) {
            showMessage("No restaurants found in this area.");
            document.getElementById('restaurant-list').innerHTML = '<li>No restaurants found.</li>';
            return;
        }

        calculateTravelTimes(restaurants);

    } catch (err) {
        showMessage("Failed to load restaurant locations.");
        console.error("Error fetching restaurant data:", err);
        document.getElementById('restaurant-list').innerHTML = '<li>Error loading restaurants.</li>';
    }
}

async function calculateTravelTimes(restaurants) {
    showMessage(`Step 2: Calculating quickest routes to ${restaurants.length} restaurants...`);

    const orsUrl = 'https://api.openrouteservice.org/v2/matrix/driving-car';
    // Origins and destinations: ORS expects [lng, lat]
    const origins = [[userLocation[1], userLocation[0]]]; // [lng, lat]
    const destinations = restaurants.map(r => r.coords);

    // Ensure ORS_API_KEY is present as a global
    const API_KEY = (typeof ORS_API_KEY !== 'undefined') ? ORS_API_KEY : window.ORS_API_KEY;
    if (!API_KEY || API_KEY.includes("YOUR_")) {
        showMessage("Please set a valid ORS API key in config.js (window.ORS_API_KEY).");
        document.getElementById('restaurant-list').innerHTML = '<li style="color:red;">Please set your ORS API key in config.js</li>';
        return;
    }

    try {
        const res = await fetch(orsUrl, {
            method: 'POST',
            headers: {
                'Authorization': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                locations: [...origins, ...destinations],
                sources: [0],
                destinations: [...Array(restaurants.length).keys()].map(i => i + 1),
                metrics: ["duration"]
            })
        });

        if (!res.ok) {
            let msg = `ORS Matrix failed (HTTP ${res.status})`;
            try { const errJson = await res.json(); if (errJson?.error?.message) msg = errJson.error.message; } catch(e){}
            throw new Error(msg);
        }

        const data = await res.json();
        const durations = data.durations?.[0];
        if (!durations) throw new Error("No durations in ORS response.");

        const restaurantsWithTime = restaurants.map((r, index) => ({
            ...r,
            durationSec: durations[index] ?? Infinity
        }));

        displaySortedRestaurants(restaurantsWithTime);

    } catch (err) {
        showMessage("Failed to calculate travel times. Displaying unsorted restaurants.");
        console.error("ORS Matrix Error:", err);
        // Fallback: show unsorted markers and message
        document.getElementById('restaurant-list').innerHTML = '<li>Error calculating travel times; showing locations only.</li>';
        restaurants.forEach(r => {
            L.marker([r.lat, r.lng]).addTo(map)
                .bindPopup(`<b>${r.name}</b> (Time calc failed)`);
        });
    }
}

function displaySortedRestaurants(restaurants) {
    restaurants.sort((a, b) => (a.durationSec ?? Infinity) - (b.durationSec ?? Infinity));
    showMessage(`Finished! Sorted ${restaurants.length} restaurants by predicted travel time.`);

    const ul = document.getElementById('restaurant-list');
    ul.innerHTML = ''; // clear loading

    restaurants.forEach((r, index) => {
        const durationMin = isFinite(r.durationSec) ? (r.durationSec / 60).toFixed(1) : '—';
        const li = document.createElement('li');
        li.innerHTML = `<strong>#${index + 1}. ${r.name}</strong>
                        <small class="muted">ETA: <span class="eta">${durationMin} min</span></small>`;
        li.addEventListener('click', () => {
            map.setView([r.lat, r.lng], 16);
        });
        ul.appendChild(li);

        L.marker([r.lat, r.lng]).addTo(map)
            .bindPopup(`<b>#${index + 1}. ${r.name}</b><br>Quickest ETA: <b>${durationMin} min</b>`);
    });
}

window.onload = initRestaurantMap;
