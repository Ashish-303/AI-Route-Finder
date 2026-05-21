// js/safety.js
// Ashish's Note: This file controls the "Emergency Safety Mode" page.
// It finds nearby emergency services (Police, Hospital, Pharmacy) using Overpass.
// It also loads and toggles the high-risk zones from data/safe-zones.geojson.

let map;
// Ashish's Note: Default Surat center (simulating user location).
const userLocation = [21.1702, 72.8311]; // [lat, lng]
let emergencyLayer; // Layer group to hold the markers
let safetyZoneLayer; // Layer group for the GeoJSON risk zones
let safetyZonesLoaded = false; // Ashish's Note: Flag to check if we've fetched the data

/**
 * Ashish's Note: Initializes the safety map and hooks up the buttons.
 */
function initSafetyMap() {
    // Ashish's Note: We can proceed even if the key isn't set, as Overpass is public.
    if (typeof ORS_API_KEY === 'undefined' || ORS_API_KEY.includes("YOUR_ACTUAL")) {
        console.warn("API Key (from config.js) not found. Safety POIs will work, but routing would fail.");
    }

    try {
        map = L.map('map').setView(userLocation, 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'Ashish\'s Note: &copy; OpenStreetMap contributors'
        }).addTo(map);

        // *** ASHISH'S NOTE: THIS IS THE FIX ***
        // Changed L.layerGroup() to L.featureGroup() which has the .getBounds() function.
        emergencyLayer = L.featureGroup().addTo(map); 
        
        safetyZoneLayer = L.layerGroup(); // Ashish's Note: Do NOT add to map yet.

        // Ashish's Note: User's location marker.
        L.marker(userLocation, { zIndexOffset: 1000 }).addTo(map)
            .bindPopup("Your Location (Simulated)").openPopup();

        // Ashish's Note: Hook up the buttons from safety.html
        document.getElementById('findPolice').addEventListener('click', () => findNearbyEmergency('police'));
        document.getElementById('findHospital').addEventListener('click', () => findNearbyEmergency('hospital'));
        document.getElementById('findPharmacy').addEventListener('click', () => findNearbyEmergency('pharmacy'));
        document.getElementById('toggleSafetyZones').addEventListener('click', toggleSafetyZones);
        
        updateStatus("Map initialized. Select an emergency service or toggle risk zones.");

    } catch (e) {
        console.error("Map initialization failed:", e);
        updateStatus("Error: Map failed to load. Please refresh.", true);
    }
}

/**
 * Ashish's Note: Reusable function to find emergency POIs using Overpass.
 * @param {string} amenity - The OSM amenity tag (e.g., 'police', 'hospital').
 */
async function findNearbyEmergency(amenity) {
    updateStatus(`Searching for nearest ${amenity} locations...`);
    emergencyLayer.clearLayers(); // Clear old markers

    const [lat, lng] = userLocation;
    // Ashish's Note: 5km search radius
    const bbox = [lat - 0.05, lng - 0.05, lat + 0.05, lng + 0.05]; 
    
    const query = `
        [out:json][timeout:25];
        (
          node["amenity"="${amenity}"](${bbox.join(',')});
          way["amenity"="${amenity}"](${bbox.join(',')});
        );
        (._;>;);
        out center;
    `;
    const overpassUrl = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);

    try {
        const res = await fetch(overpassUrl);
        if (!res.ok) throw new Error(`Overpass API failed (HTTP ${res.status})`);
        
        const data = await res.json();
        
        const locations = data.elements
            .filter(el => (el.lat || el.center?.lat) && (el.lon || el.center?.lon))
            .map(el => ({ 
                name: el.tags?.name || `${amenity.charAt(0).toUpperCase() + amenity.slice(1)}`, // Use amenity name if no tag
                lat: el.lat || el.center?.lat, 
                lng: el.lon || el.center?.lon
            }));

        if (locations.length === 0) {
            updateStatus(`No ${amenity} locations found nearby.`, true);
            return;
        }

        // Ashish's Note: For this feature, just showing markers is enough.
        locations.slice(0, 15).forEach(loc => { // Show top 15
            L.marker([loc.lat, loc.lng])
                .addTo(emergencyLayer)
                .bindPopup(`<b>${loc.name}</b><br>(${amenity})`);
        });
        updateStatus(`Found ${locations.length} ${amenity} locations.`, false);
        
        // Ashish's Note: This line will now work correctly.
        map.fitBounds(emergencyLayer.getBounds(), { padding: [50, 50] }); // Zoom to fit markers

    } catch (err) {
        console.error("Ashish's Note: Error fetching POI data:", err);
        updateStatus(`Error: ${err.message}`, true);
    }
}

/**
 * Ashish's Note: Function to load and show/hide the GeoJSON safety zones.
 */
async function toggleSafetyZones() {
    const button = document.getElementById('toggleSafetyZones');
    
    // Ashish's Note: Check if layers are already on the map
    if (map.hasLayer(safetyZoneLayer)) {
        map.removeLayer(safetyZoneLayer);
        button.textContent = "Show High-Risk Zones";
        button.classList.remove('active');
        updateStatus("Risk zones hidden.", false);
        return;
    }
    
    // Ashish's Note: If zones are already loaded, just add them back to the map.
    if (safetyZonesLoaded) {
        map.addLayer(safetyZoneLayer);
        button.textContent = "Hide High-Risk Zones";
        button.classList.add('active');
        updateStatus("High-risk zones are now displayed.", false);
        return;
    }

    // Ashish's Note: Zones are not loaded yet. Fetch and display them.
    updateStatus("Loading safety/risk zones...", false);
    try {
        // Ashish's Note: Path is relative to the HTML file (pages/safety.html)
        const res = await fetch('../data/safe-zones.geojson'); 
        if (!res.ok) throw new Error("safe-zones.geojson file not found in /data/ folder. This is a required file.");
        
        const data = await res.json();
        
        L.geoJSON(data, {
            style: (feature) => {
                // Ashish's Note: Style based on the 'risk' property in the GeoJSON
                let color = '#ff7800'; // Default orange (Other)
                if (feature.properties.risk === 'High - Waterlogging') color = '#007bff'; // Blue
                if (feature.properties.risk === 'High - Crime') color = '#dc3545'; // Red
                return { color: color, weight: 2, opacity: 0.6, fillOpacity: 0.3 };
            },
            onEachFeature: (feature, layer) => {
                // Ashish's Note: Add tooltips to each zone
                if (feature.properties && feature.properties.name) {
                    layer.bindPopup(`<b>Risk Zone: ${feature.properties.name}</b><br>Type: ${feature.properties.risk}`);
                }
            }
        }).addTo(safetyZoneLayer); // Add the styled GeoJSON to our layer group
        
        map.addLayer(safetyZoneLayer); // Add the layer group to the map
        safetyZonesLoaded = true; // Ashish's Note: Set the flag
        button.textContent = "Hide High-Risk Zones";
        button.classList.add('active');
        updateStatus("High-risk zones are now displayed.", false);

    } catch (err) {
        updateStatus(`Error loading risk zones: ${err.message}`, true);
        console.error(err);
    }
}

/**
 * Ashish's Note: Simple status updater for the UI.
 * @param {string} msg - The message to display.
 * @param {boolean} isError - If true, style as an error.
 */
function updateStatus(msg, isError = false) {
    const statusEl = document.getElementById('safety-status');
    if (statusEl) {
        statusEl.textContent = msg;
        statusEl.style.color = isError ? '#dc3545' : '#333'; // Red for error, dark grey for normal
        statusEl.style.fontWeight = isError ? 'bold' : 'normal';
    }
    console.log("Safety Status:", msg);
}

// Ashish's Note: Start the app once the page is fully loaded.
window.onload = initSafetyMap;

