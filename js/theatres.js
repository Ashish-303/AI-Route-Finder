// js/theatres.js
// Ashish's Note: Smart Theatre Finder - Fetches theatres and sorts them by fastest ETA 
// using the ORS Distance Matrix API for predictive routing time.
// This version uses GLOBAL constants from config.js (no import/export).

let map;
// Ashish's Note: Default Surat center (simulate user location for search origin).
const userLocation = [21.1702, 72.8311]; // [lat, lng]
let theatreListElement; // Ashish's Note: Reference to the <ul>
let loadingStatusElement; // Ashish's Note: Reference to the "Loading..." text

/**
 * Ashish's Note: Helper function to update the status text in the sidebar.
 * @param {string} msg - The message to display.
 * @param {boolean} isError - If true, style as an error.
 */
function updateStatus(msg, isError = false) {
    if (!loadingStatusElement) {
        loadingStatusElement = document.getElementById('loadingStatus');
    }
    if (loadingStatusElement) {
        loadingStatusElement.textContent = msg;
        loadingStatusElement.style.color = isError ? 'red' : '#555';
    }
    console.log("Status:", msg);
}

/**
 * Ashish's Note: Helper function to update the main results list.
 * @param {string} html - The HTML to insert into the list.
 */
function updateTheatreList(html) {
    if (!theatreListElement) {
        theatreListElement = document.getElementById('theatre-list');
    }
    if (theatreListElement) {
        theatreListElement.innerHTML = html;
    }
}

/**
 * Ashish's Note: Initializes the map and starts the theatre search.
 */
function initTheatreMap() {
    theatreListElement = document.getElementById('theatre-list');
    loadingStatusElement = document.getElementById('loadingStatus');
    
    // Ashish's Note: CRITICAL check for the API Key from config.js
    if (typeof ORS_API_KEY === 'undefined' || ORS_API_KEY.includes("YOUR_ACTUAL")) {
        console.error("API Key (from config.js) not found.");
        updateStatus("CRITICAL ERROR: API Key not found. Please check config.js.", true);
        return;
    }

    try {
        map = L.map('map').setView(userLocation, 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'Ashish\'s Note: &copy; OpenStreetMap contributors'
        }).addTo(map);

        L.marker(userLocation, { zIndexOffset: 1000 }).addTo(map)
            .bindPopup("Your Location (Simulated)").openPopup();

        loadNearbyTheatres(userLocation);
        
    } catch (e) {
        console.error("Map initialization failed:", e);
        updateStatus("Error: Map failed to load. Please refresh.", true);
    }
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

/**
 * Ashish's Note: Step 1: Fetches Theatre/Cinema locations using Overpass API.
 * @param {Array} center - [lat, lng] coordinates to center the search.
 */
async function loadNearbyTheatres(center) {
    updateStatus("Searching for cinemas/theatres in the Surat area...");

    const [lat, lng] = center;
    // Ashish's Note: Bounding box for local search (approx 8km radius)
    const bbox = [lat - 0.08, lng - 0.08, lat + 0.08, lng + 0.08]; 
    
    // Ashish's Note: Search for amenities tagged as 'cinema'
    const query = `
        [out:json][timeout:25];
        (
          node["amenity"="cinema"](${bbox.join(',')});
          way["amenity"="cinema"](${bbox.join(',')});
          relation["amenity"="cinema"](${bbox.join(',')});
        );
        (._;>;);
        out center;
    `;
    try {
        const data = await fetchFromOverpass(query);
        
        // Ashish's Note: Filter, map, and remove duplicates by name
        const theatreMap = new Map();
        data.elements
            .filter(el => (el.lat || el.center?.lat) && (el.lon || el.center?.lon) && el.tags?.name)
            .forEach(el => {
                const theatre = { 
                    name: el.tags.name, 
                    lat: el.lat || el.center?.lat, 
                    lng: el.lon || el.center?.lon,
                    // Ashish's Note: ORS requires coordinates as [lng, lat]
                    coords: [el.lon || el.center?.lon, el.lat || el.center?.lat] 
                };
                // Ashish's Note: Only add one entry per theatre name
                if (!theatreMap.has(theatre.name)) {
                    theatreMap.set(theatre.name, theatre);
                }
            });

        const theatres = Array.from(theatreMap.values());
        
        if (theatres.length === 0) {
            updateStatus("No theatres or cinemas found in this area.", false);
            updateTheatreList(""); // Clear "Loading..."
            return;
        }

        // Ashish's Note: Proceed to Step 2: Calculate travel time.
        calculateTravelTimes(theatres.slice(0, 20)); // Limit to first 20

    } catch (err) {
        console.error("Ashish's Note: Error fetching theatre data:", err);
        updateStatus(`Error: ${err.message}`, true);
    }
}

/**
 * Ashish's Note: Step 2: Uses ORS Distance Matrix API to find the quickest route time.
 * @param {Array<Object>} theatres - List of theatre objects.
 */
async function calculateTravelTimes(theatres) {
    updateStatus(`Calculating quickest travel times to ${theatres.length} locations...`);

    const orsUrl = 'https://api.openrouteservice.org/v2/matrix/driving-car';
    
    // ORS requires locations as [[lng, lat]]
    const origins = [[userLocation[1], userLocation[0]]]; 
    const destinations = theatres.map(t => t.coords);

    try {
        const res = await fetch(orsUrl, {
            method: 'POST',
            headers: {
                'Authorization': ORS_API_KEY, // Ashish's Note: This is the GLOBAL key
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                locations: [...origins, ...destinations],
                sources: [0], 
                destinations: [...Array(theatres.length).keys()].map(i => i + 1), 
                metrics: ["duration"] 
            })
        });

        if (!res.ok) {
            let errorMsg = `ORS Matrix API failed (HTTP ${res.status})`;
            try {
                const errorData = await res.json();
                if(errorData.error) errorMsg = errorData.error.message;
            } catch(e) {}
            throw new Error(errorMsg);
        }
        
        const data = await res.json();

        if (!data.durations) {
            console.error("ORS Matrix Error: 'durations' array not found in response.", data);
            throw new Error("Invalid response from ORS Matrix API.");
        }

        // The durations matrix returns time in seconds.
        const durations = data.durations[0]; 

        // Ashish's Note: Combine theatre data with calculated travel time (duration).
        const theatresWithTime = theatres.map((t, index) => ({
            ...t,
            durationSec: durations[index] 
        }));

        // Ashish's Note: Proceed to Step 3: Sort by the AI's preferred metric (time).
        displaySortedTheatres(theatresWithTime);

    } catch (err) {
        console.error("Ashish's Note: ORS Matrix Error:", err);
        updateStatus(`Error: ${err.message}`, true);
        // Fallback: display locations without time
        displaySortedTheatres(theatres); // Will sort by name as fallback
    }
}


/**
 * Ashish's Note: Step 3: Sorts and displays the Theatres on the map and in the list.
 * @param {Array<Object>} theatres - List of Theatres with (optional) calculated durations.
 */
function displaySortedTheatres(theatres) {
    // Ashish's Note: The core smart decision: sort by duration (quickest ETA first)
    // If duration is missing (e.g., API failed), sort by name.
    theatres.sort((a, b) => {
        if (a.durationSec != null && b.durationSec != null) {
            return a.durationSec - b.durationSec;
        }
        return a.name.localeCompare(b.name); // Fallback sort
    });

    let listHtml = ''; // Ashish's Note: Build the new HTML for the list

    theatres.forEach((t, index) => {
        const durationMin = (t.durationSec / 60).toFixed(1);
        const etaHtml = t.durationSec != null ? `<span class="eta">${durationMin} min drive</span>` : `(ETA unknown)`;

        // Ashish's Note: Add to the HTML list
        listHtml += `
            <li data-lat="${t.lat}" data-lng="${t.lng}">
                <strong>#${index + 1}. ${t.name}</strong>
                <small>Quickest ETA: ${etaHtml}</small>
            </li>
        `;

        // Add markers to map
        const marker = L.marker([t.lat, t.lng]).addTo(map)
            .bindPopup(`
                <b>#${index + 1}. ${t.name}</b><br>
                Quickest ETA: <span style="color:#28a745; font-weight:bold;">${etaHtml}</span>
            `);
            
        // Ashish's Note: Add click event to list item to open map popup
        marker.on('click', () => marker.openPopup());
    });
    
    updateStatus(`Displaying top ${theatres.length} results.`, false); // Update status
    updateTheatreList(listHtml); // Update the list
    
    // Ashish's Note: Add click listeners to the <li> elements AFTER they are in the DOM
    document.querySelectorAll('#theatre-list li').forEach(item => {
        item.addEventListener('click', (e) => {
            const lat = e.currentTarget.dataset.lat;
            const lng = e.currentTarget.dataset.lng;
            
            if (!lat || !lng) return; // Don't fly if data is missing
            
            map.flyTo([lat, lng], 16); // Zoom to the marker
            
            // Ashish's Note: Find and open the corresponding marker popup
            map.eachLayer(layer => {
                if (layer instanceof L.Marker) {
                    if (layer.getLatLng().lat == lat && layer.getLatLng().lng == lng) {
                        layer.openPopup();
                    }
                }
            });
        });
    });
}

// Ashish's Note: Start the app once the page is fully loaded.
window.onload = initTheatreMap;

