// js/pps-route.js
// Fixed version: use as ES module (script tag must be type="module")

import { ORS_API_KEY, SURAT_CONGESTION_ZONES } from '../config.js'; // ensure config.js exports these

// PPSU coordinates (lat, lng)
const ppsuLatLng = [21.4872, 73.0791]; // [lat, lng] - human readable

// initialize map with [lat, lng]
const map = L.map('map').setView(ppsuLatLng, 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Ashish\'s Note: © OpenStreetMap contributors'
}).addTo(map);

// Marker for PPSU
L.marker(ppsuLatLng).addTo(map).bindPopup("P P Savani University (Destination)").openPopup();

let routeLayer;
let startMarker;

// Haversine utility (unchanged)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isPointInCongestionZone(lat, lng) {
  if (typeof SURAT_CONGESTION_ZONES === 'undefined') {
    // if config not present, behave harmlessly
    return { isCongested: false, penalty: 1.0, name: '' };
  }
  for (const zone of SURAT_CONGESTION_ZONES) {
    const zoneLat = zone.center[0];
    const zoneLng = zone.center[1];
    const distance = calculateDistance(lat, lng, zoneLat, zoneLng);
    if (distance <= zone.radiusKm) {
      return { isCongested: true, penalty: zone.penalty, name: zone.name };
    }
  }
  return { isCongested: false, penalty: 1.0, name: '' };
}

// your scoring function (unchanged logic)
function calculateCustomRouteScore(routeFeature, vehicleType = 'driving-car') {
  let totalWeightedDuration = 0;
  if (!routeFeature || !routeFeature.properties || !routeFeature.geometry) {
    return { finalScore: Infinity, isCongested: false, zoneName: '' };
  }
  const baseDuration = routeFeature.properties.summary.duration || 0;
  const coordinates = routeFeature.geometry.coordinates || [];
  const numTurns = (routeFeature.properties.segments && routeFeature.properties.segments[0] && routeFeature.properties.segments[0].steps)
                   ? routeFeature.properties.segments[0].steps.length
                   : 0;
  const segmentBaseDuration = (coordinates.length > 0) ? (baseDuration / coordinates.length) : 0;
  let congestionDetails = { isCongested: false, penalty: 1.0, name: '' };

  for (let i = 0; i < Math.max(1, coordinates.length - 1); i++) {
    const [lng, lat] = coordinates[i];
    let segmentPenalty = 1.0;
    const congestion = isPointInCongestionZone(lat, lng);
    if (congestion.isCongested) {
      if (!congestionDetails.isCongested || congestion.penalty > congestionDetails.penalty) {
        congestionDetails = congestion;
      }
      segmentPenalty *= congestion.penalty;
      if (vehicleType === 'driving-two-wheeler') segmentPenalty *= 0.90;
    }
    totalWeightedDuration += segmentBaseDuration * segmentPenalty;
  }

  const heuristicPenalty = numTurns * 15;
  const finalScore = totalWeightedDuration + heuristicPenalty;

  return { finalScore, isCongested: congestionDetails.isCongested, zoneName: congestionDetails.name };
}

// Main click handler
map.on('click', async function (e) {
  const startLatLng = e.latlng;
  const startCoords = [startLatLng.lng, startLatLng.lat]; // [lng, lat]
  const endCoords = [ppsuLatLng[1], ppsuLatLng[0]];        // [lng, lat] for ORS

  if (startMarker) map.removeLayer(startMarker);
  startMarker = L.marker(startLatLng).addTo(map).bindPopup("Your Start Location").openPopup();

  if (routeLayer) map.removeLayer(routeLayer);

  const orsProfile = 'driving-car';
  const url = `https://api.openrouteservice.org/v2/directions/${orsProfile}/geojson`;

  const headers = {
    'Authorization': ORS_API_KEY,
    'Content-Type': 'application/json'
  };

  // IMPORTANT: use alternative_routes (object) instead of invalid 'options.alternatives'
  const payload = {
    coordinates: [startCoords, endCoords],
    instructions: true,
    alternative_routes: {
      target_count: 2,
      share_factor: 0.6
    }
  };

  const directionsDiv = document.getElementById('directions');
  if (directionsDiv) directionsDiv.innerHTML = '<p style="color:#2c5282; font-weight: bold;">Calculating Smart Route...</p>';

  try {
    // Use body (already JSON string)
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)   // send correct JSON once
    });

    if (!response.ok) {
      // try to parse error message for better diagnostics
      let errText = `Routing request failed (HTTP ${response.status}).`;
      try { const errJson = await response.json(); if (errJson && errJson.error && errJson.error.message) errText = errJson.error.message; } catch(e) {}
      throw new Error(errText);
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      throw new Error('No routes returned by ORS.');
    }

    let bestRoute = null;
    let lowestScore = Infinity;
    let routeWarning = '';

    data.features.forEach(feature => {
      const { finalScore, isCongested, zoneName } = calculateCustomRouteScore(feature, 'driving-car');
      if (finalScore < lowestScore) {
        lowestScore = finalScore;
        bestRoute = feature;
        routeWarning = isCongested ? `⚠️ Route passes near ${zoneName}` : '✅ Clear of major congestion';
      }
    });

    if (!bestRoute) throw new Error('No best route selected.');

    routeLayer = L.geoJSON(bestRoute, {
      style: { color: '#28a745', weight: 6 }
    }).addTo(map);

    map.fitBounds(routeLayer.getBounds());

    const summary = bestRoute.properties.summary || { distance: 0 };
    const distanceKm = (summary.distance / 1000).toFixed(2);
    const durationMin = (lowestScore / 60).toFixed(2);

    const steps = (bestRoute.properties.segments && bestRoute.properties.segments[0] && bestRoute.properties.segments[0].steps) || [];

    let instructionsHtml = `<h3>Smart Route Details</h3>
      <p><strong>Distance:</strong> ${distanceKm} km</p>
      <p><strong>Time (AI Optimized):</strong> ${durationMin} minutes</p>
      <p>${routeWarning}</p>
      <h3>Turn-by-Turn Directions:</h3><ol>`;

    steps.forEach(step => {
      instructionsHtml += `<li>${step.instruction} (${(step.distance/1000).toFixed(2)} km)</li>`;
    });
    instructionsHtml += '</ol>';

    if (directionsDiv) directionsDiv.innerHTML = instructionsHtml;

  } catch (err) {
    console.error("Routing error:", err);
    if (directionsDiv) directionsDiv.innerHTML = `<p style="color:red; font-weight:bold;">Failed to get directions: ${err.message}</p>`;
  }
});
