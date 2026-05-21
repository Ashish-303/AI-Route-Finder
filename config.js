// config.js
// --------------------------------------------------------
// Ashish's Note: Central configuration file for Smart AI Route Finder.
// All variables are defined as GLOBALS (attached to `window`)
// so that non-module JS files can access them directly.
// --------------------------------------------------------

// --- 1. OpenRouteService (ORS) API Key ---
window.ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjYwYzJjNzdhOGY0ZjQyYmUzMmY3ZWQxM2NjZTJhYzU5MGI1NzNjY2I3OTAyMGZjMWExMmI5NWE2IiwiaCI6Im11cm11cjY0In0=";

// --- 2. Congestion Zone Coordinates & Penalties (The Core AI Data) ---
// These define Surat's known traffic bottlenecks.
// Penalty factor: 1.0 = normal speed; 1.45 = 45% slower travel time (Heavy Congestion)
window.SURAT_CONGESTION_ZONES = [
    { 
        name: "Old City/Chowk Bazaar (CBD)", 
        center: [21.1917, 72.8286], // [Lat, Lng]
        radiusKm: 1.5,
        penalty: 1.45, 
        reason: "Highest congestion due to Walled City chaos and commercial activity."
    },
    { 
        name: "Majura Gate / Ring Road Intersection", 
        center: [21.1843, 72.8028], 
        radiusKm: 1.0, 
        penalty: 1.35, 
        reason: "High PCU volume during peak hours."
    },
    { 
        name: "Amroli Bridge Approach", 
        center: [21.2384, 72.8622], 
        radiusKm: 1.5,
        penalty: 1.4, 
        reason: "Bridge approach and market-related congestion."
    },
    {
        name: "Dindoli Intersection",
        center: [21.1718, 72.8797], 
        radiusKm: 1.0,
        penalty: 1.25, 
        reason: "Known intersection issue and high volume."
    }
];

// --- 3. Environmental / External Penalties (Used by AI Scoring) ---
// These factors simulate delays from non-traffic causes.
window.ENVIRONMENTAL_PENALTIES = {
    HIGH_AQI_DELAY_FACTOR: 1.10,   // 10% delay for poor air quality
    HEAVY_RAIN_DELAY_FACTOR: 1.15  // 15% delay during heavy rainfall
};
