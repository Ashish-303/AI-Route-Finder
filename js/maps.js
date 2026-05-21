// js/maps.js
// Ashish's Note: This file provides the central map initialization logic for any simple map page.

// Load the map centered on Surat
const map = L.map('map').setView([21.1702, 72.8311], 13); // Surat coordinates as default

// Load tile layer (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  // Ashish's Note: Keeping attribution clean for open-source reference.
  attribution: 'Ashish\'s Note: &copy; OpenStreetMap contributors' 
}).addTo(map);

// Ashish's Note: General click handler to place a marker for quick testing/debugging.
// This is overridden by the specialized logic in files like route.js.
map.on('click', function (e) {
  L.marker(e.latlng).addTo(map).bindPopup("Clicked Location").openPopup();
});
