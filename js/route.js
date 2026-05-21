// Ashish's Note: This is the core script for the Smart AI Route Finder. 
// It uses a custom scoring algorithm to select the best route based on predicted Surat traffic.
// This version uses GLOBAL constants from config.js to avoid module/import errors.

// Ashish's Note: Map is initialized immediately.
let map;
try {
  map = L.map("map").setView([21.1702, 72.8311], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "Ashish's Note: Map data from OpenStreetMap contributors"
  }).addTo(map);
} catch (e) {
  console.error("Map initialization failed:", e);
  alert("Error: Could not initialize the map. Is Leaflet.js loaded?");
}


let startCoord = null; // [lng, lat]
let endCoord = null;   // [lng, lat]
let routeLayer = null;

// ===============================================================
// === AI ALGORITHM: CUSTOM ROUTE SCORING LOGIC ==================
// ===============================================================

// Ashish's Note: Utility for Haversine distance calculation (needed for congestion check).
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

// Ashish's Note: Checks if a route point is near a known Surat bottleneck (The H-function check).
function isPointInCongestionZone(lat, lng) {
    // Ashish's Note: This depends on SURAT_CONGESTION_ZONES from config.js
    if (typeof SURAT_CONGESTION_ZONES === 'undefined') {
        console.error("AI Logic Error: SURAT_CONGESTION_ZONES (from config.js) is not defined.");
        return { isCongested: false, penalty: 1.0, name: '' };
    }

    for (const zone of SURAT_CONGESTION_ZONES) {
        // center is defined as [Lat, Lng] in config.js
        const zoneLat = zone.center[0]; 
        const zoneLng = zone.center[1];
        
        const distance = calculateDistance(lat, lng, zoneLat, zoneLng);

        if (distance <= zone.radiusKm) {
            return { isCongested: true, penalty: zone.penalty, name: zone.name };
        }
    }
    return { isCongested: false, penalty: 1.0, name: '' };
}

// Ashish's Note: Core AI scoring function (The heart of the project).
function calculateCustomRouteScore(routeFeature, vehicleType) {
    let totalWeightedDuration = 0;
    
    // Ashish's Note: Check if routeFeature and properties exist to prevent crashes
    if (!routeFeature || !routeFeature.properties || !routeFeature.properties.summary || !routeFeature.geometry) {
        console.error("AI Scoring Error: Invalid route feature data received.");
        return { finalScore: Infinity, isCongested: false, zoneName: '' }; // Return a very high score to discard this route
    }
    
    const baseDuration = routeFeature.properties.summary.duration; // in seconds
    const coordinates = routeFeature.geometry.coordinates; // [[lng, lat], ...]
    
    // Ashish's Note: Ensure segments and steps exist before trying to access length
    const numTurns = (routeFeature.properties.segments && routeFeature.properties.segments[0] && routeFeature.properties.segments[0].steps) 
                     ? routeFeature.properties.segments[0].steps.length 
                     : 10; // Default penalty if steps are missing

    // Ashish's Note: Handle potential division by zero if coordinates are empty
    const segmentBaseDuration = (coordinates.length > 0) ? (baseDuration / coordinates.length) : 0; 
    let congestionDetails = { isCongested: false, name: '', penalty: 1.0 };

    for (let i = 0; i < coordinates.length - 1; i++) {
        const [lng, lat] = coordinates[i];
        let segmentPenalty = 1.0; 
        
        const congestion = isPointInCongestionZone(lat, lng);
        
        if (congestion.isCongested) {
            if (congestion.penalty > congestionDetails.penalty || !congestionDetails.isCongested) {
                congestionDetails = congestion;
            }
            
            segmentPenalty *= congestion.penalty;
            
            if (vehicleType === 'driving-two-wheeler') { 
                segmentPenalty *= 0.90; 
            }
        }
        
        totalWeightedDuration += segmentBaseDuration * segmentPenalty;
    }

    const heuristicPenalty = numTurns * 15; // 15 seconds penalty per turn/step
    const finalScore = totalWeightedDuration + heuristicPenalty;

    return { finalScore, isCongested: congestionDetails.isCongested, zoneName: congestionDetails.name };
}

// ===============================================================
// === UI & MAIN ROUTE FINDING LOGIC =============================
// ===============================================================

// Ashish's Note: Make sure the button exists before adding listener.
const findRouteButton = document.getElementById("findRoute");
if (findRouteButton) {
  findRouteButton.addEventListener("click", async () => {
    
    // Ashish's Note: Check if the API key is loaded from config.js
    if (typeof ORS_API_KEY === 'undefined' || ORS_API_KEY === "" || ORS_API_KEY.includes("YOUR_ACTUAL")) {
        alert("CRITICAL ERROR: API Key (config.js) not found or not set. Please update config.js.");
        return;
    }

    if (!startCoord || !endCoord) {
      alert("Ashish's Note: Please select both a start and end location.");
      return;
    }
    
    const vehicleType = document.getElementById("vehicleType").value; 
    const orsProfile = vehicleType === 'driving-two-wheeler' ? 'driving-two-wheeler' : 'driving-car';

    const url = `https://api.openrouteservice.org/v2/directions/${orsProfile}/geojson`;
    const headers = {
      "Authorization": ORS_API_KEY,
      "Content-Type": "application/json"
    };

    // *** ASHISH'S NOTE: THIS IS THE FIX ***
    // 'alternatives' is a top-level parameter, not inside 'options'.
    const body = JSON.stringify({
  coordinates: [startCoord, endCoord],
  alternative_routes: {
    target_count: 3,   // Request up to 3 routes
    share_factor: 0.6  // How different routes can be
  }
});


    try {
      const res = await fetch(url, { method: "POST", headers, body });
      
      // Ashish's Note: This is where the error in the screenshot is triggered.
      if (!res.ok) {
          // *** ASHISH'S NOTE: NEW, SMARTER ERROR HANDLING ***
          let errorMsg = `ORS Routing failed (HTTP ${res.status}).`;
          try {
              const errorData = await res.json();
              console.error("ORS API Error Response:", errorData);
              if (res.status === 429) {
                  errorMsg = "ORS Error: Too many requests. You have hit the 'Quota per Minute' limit. Please wait 1 minute and try again.";
              } else if (errorData.error && errorData.error.message) {
                  // This will now catch the "alternatives" error
                  errorMsg = `ORS Error: ${errorData.error.message}. Check if coordinates are routable.`;
              }
          } catch (e) {
              // Failed to parse JSON, just use the status
              errorMsg = `ORS Routing failed with HTTP status ${res.status}. Check API key and console.`;
          }
          throw new Error(errorMsg);
      }
      
      const data = await res.json();

      if (!data.features || data.features.length === 0) {
        throw new Error("No routes found between these locations. The points may be unreachable.");
      }

      let bestRoute = null;
      let lowestScore = Infinity;
      let finalDistance = 0;
      let routeWarning = "✅ AI Route: Optimal path selected, clear route found.";

      data.features.forEach(feature => {
          const { finalScore, isCongested, zoneName } = calculateCustomRouteScore(feature, vehicleType); 

          if (finalScore < lowestScore) {
              lowestScore = finalScore;
              bestRoute = feature;
              finalDistance = (feature.properties.summary.distance / 1000).toFixed(2);
              
              if (isCongested) {
                  routeWarning = `⚠️ AI Warning: Path passes near **${zoneName}**. Custom congestion delay applied.`;
              } else {
                  routeWarning = "✅ AI Route: Best predicted time route selected.";
              }
          }
      });

      if (routeLayer) { map.removeLayer(routeLayer); }

      routeLayer = L.geoJSON(bestRoute, {
          style: { color: "#28a745", weight: 6 } // Ashish's Note: Green for the AI route
      }).addTo(map);

      map.fitBounds(routeLayer.getBounds());

      const durationMin = (lowestScore / 60).toFixed(2); 
      
      const infoDiv = document.getElementById("routeInfo");
      infoDiv.innerHTML = `
          <p><strong>Distance:</strong> <span id="distance">${finalDistance} km</span></p>
          <p><strong>Time (<span style="color:#28a745; font-weight:bold;">AI Optimized</span>):</strong> <span id="duration">${durationMin} minutes</span></p>
          <p style="color:#dc3545; font-weight:bold;">${routeWarning}</p>
      `;

    } catch (err) {
      // Ashish's Note: This will now show the *specific* error message.
      alert("Ashish's Note: " + err.message);
      console.error(err);
    }
  });
} else {
  console.error("Initialization Error: 'findRoute' button not found.");
}


// ===============================================================
// === AUTOCOMPLETE LOGIC (Using Nominatim) ======================
// ===============================================================

function handleAutocomplete(inputId, suggestionsId, callback) {
  const input = document.getElementById(inputId);
  const suggestions = document.getElementById(suggestionsId);

  if (!input || !suggestions) {
    console.error(`Autocomplete Error: Element #${inputId} or #${suggestionsId} not found.`);
    return;
  }

  // Ashish's Note: Bounding box for Surat City to restrict search results.
  // [min_lon, min_lat, max_lon, max_lat] -> Approx. [72.7, 21.0, 73.0, 21.3]
  const SURAT_BBOX = "72.7,21.0,73.0,21.3";

  input.addEventListener("input", async () => {
    const query = input.value;
    if (query.length < 3) {
      suggestions.innerHTML = "";
      suggestions.style.display = 'none'; // Ashish's Note: Hide empty list
      return;
    }

    // Ashish's Note: Use viewbox and bounded=1 to prioritize results within Surat area.
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=${SURAT_BBOX}&bounded=1&limit=5`;
    
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Nominatim search failed');
      const results = await res.json();

      suggestions.innerHTML = "";
      if (results.length > 0) {
        suggestions.style.display = 'block'; // Ashish's Note: Show list
        results.forEach(place => {
          const li = document.createElement("li");
          li.textContent = place.display_name;
          li.addEventListener("click", () => {
            input.value = place.display_name;
            suggestions.innerHTML = "";
            suggestions.style.display = 'none'; // Ashish's Note: Hide on selection
            // Ashish's Note: Store coordinates as [lng, lat] for ORS API compatibility.
            callback([parseFloat(place.lon), parseFloat(place.lat)]); 
          });
          suggestions.appendChild(li);
        });
      } else {
        suggestions.style.display = 'none'; // Ashish's Note: Hide if no results
      }
    } catch (err) {
      console.error("Autocomplete fetch error:", err);
      suggestions.innerHTML = "<li>Error loading suggestions...</li>";
      suggestions.style.display = 'block';
    }
  });

  // Ashish's Note: Hide suggestions if user clicks elsewhere
  document.addEventListener('click', (e) => {
    if (suggestions.style.display === 'block' && !input.contains(e.target)) {
        suggestions.style.display = 'none';
    }
  });
}

// Ashish's Note: Init autocomplete handlers.
handleAutocomplete("start", "startSuggestions", coords => {
  startCoord = coords;
});

handleAutocomplete("end", "endSuggestions", coords => {
  endCoord = coords;
});

