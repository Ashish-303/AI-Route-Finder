// ============================
// Smart AI Route Finder - ATMs Page
// ============================

// Read the global ORS key safely
const ORS_API_KEY =
  typeof window.ORS_API_KEY !== "undefined"
    ? window.ORS_API_KEY
    : null;

// Initialize map
const map = L.map("map").setView([21.1702, 72.8311], 13);

// Load OpenStreetMap tiles
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

let userMarker;
let atmMarkers = [];

// Show message to user
function showMessage(message) {
  const msgDiv = document.getElementById("loadingStatus");
  if (msgDiv) msgDiv.innerText = message;
  console.log(message);
}

// Locate user position
if ("geolocation" in navigator) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      // Add user marker
      userMarker = L.marker([lat, lng])
        .addTo(map)
        .bindPopup("📍 You are here")
        .openPopup();

      map.setView([lat, lng], 15);
      findNearbyATMs(lat, lng);
    },
    (err) => {
      showMessage("Unable to access your location.");
      console.error(err);
    }
  );
} else {
  showMessage("Geolocation not supported by your browser.");
}

// ============================
// 1️⃣ Find nearby ATMs using Overpass API
// ============================
async function findNearbyATMs(lat, lng) {
  showMessage("Searching for nearby ATMs...");

  const query = `[out:json];node(around:2000,${lat},${lng})[amenity=atm];out;`;

  try {
    const response = await fetch("https://overpass.openstreetmap.fr/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "data=" + encodeURIComponent(query)
    });
    const data = await response.json();

    if (!data.elements || data.elements.length === 0) {
      showMessage("No ATMs found nearby.");
      return;
    }

    showMessage(`Found ${data.elements.length} ATMs nearby.`);

    const atmLocations = data.elements.map((atm) => ({
      lat: atm.lat,
      lon: atm.lon,
      name: atm.tags.name || "ATM",
    }));

    // Add ATM markers
    atmLocations.forEach((atm) => {
      const marker = L.marker([atm.lat, atm.lon])
        .addTo(map)
        .bindPopup(`🏧 ${atm.name}`);
      atmMarkers.push(marker);
    });

    calculateTravelTimes(lat, lng, atmLocations);
  } catch (err) {
    console.error("Overpass error:", err);
    showMessage("Error loading ATMs.");
  }
}

// ============================
// 2️⃣ Calculate travel time using OpenRouteService Matrix API
// ============================
async function calculateTravelTimes(userLat, userLng, atmLocations) {
  if (!ORS_API_KEY) {
    showMessage("⚠️ Missing ORS API key in config.js");
    return;
  }

  showMessage("Calculating best routes...");

  const destinations = atmLocations.map((atm) => [atm.lon, atm.lat]);
  const body = {
    locations: [[userLng, userLat], ...destinations],
    metrics: ["distance", "duration"],
  };

  try {
    const response = await fetch(
      "https://api.openrouteservice.org/v2/matrix/driving-car",
      {
        method: "POST",
        headers: {
          Authorization: ORS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!data.durations || !data.distances) {
      console.error(data);
      showMessage("ORS returned an invalid response.");
      return;
    }

    const durations = data.durations[0].slice(1); // Skip self
    const distances = data.distances[0].slice(1);

    // Combine with ATM info
    const results = atmLocations.map((atm, i) => ({
      ...atm,
      duration: durations[i],
      distance: distances[i],
    }));

    results.sort((a, b) => a.duration - b.duration);

    displayATMList(results);
  } catch (err) {
    console.error("ORS matrix error:", err);
    showMessage("Failed to calculate travel times.");
  }
}

// ============================
// 3️⃣ Display nearest ATMs in list
// ============================
function displayATMList(atms) {
  const list = document.getElementById("atmList");
  if (!list) return;

  list.innerHTML = "";
  showMessage("Nearest ATMs listed below:");

  atms.slice(0, 10).forEach((atm, i) => {
    const distanceKm = (atm.distance / 1000).toFixed(2);
    const timeMin = (atm.duration / 60).toFixed(1);

    const item = document.createElement("div");
    item.className = "atm-item";
    item.innerHTML = `
      <span>🏧 <b>${atm.name}</b></span>
      <br>
      <span>📏 ${distanceKm} km | ⏱️ ${timeMin} min</span>
    `;

    item.addEventListener("click", () => {
      map.setView([atm.lat, atm.lon], 16);
      L.popup()
        .setLatLng([atm.lat, atm.lon])
        .setContent(`🏧 ${atm.name}<br>${distanceKm} km away`)
        .openOn(map);
    });

    list.appendChild(item);
  });
}
