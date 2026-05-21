// js/weather.js
// Ashish's Note: This file fetches and displays real-time weather and AQI
// for Surat using the Open-Meteo API (no key required).
// This uses GLOBAL constants from config.js (no import/export).

let map;
// Ashish's Note: Surat coordinates for the weather API.
const SURAT_LAT = 21.1702;
const SURAT_LNG = 72.8311;

/**
 * Ashish's Note: Initializes the weather page UI.
 */
function initWeatherPage() {
    try {
        // Ashish's Note: Just show a basic map of Surat.
        map = L.map('map').setView([SURAT_LAT, SURAT_LNG], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'Ashish\'s Note: &copy; OpenStreetMap contributors'
        }).addTo(map);

        L.marker([SURAT_LAT, SURAT_LNG]).addTo(map)
            .bindPopup("Surat City").openPopup();
        
        // Ashish's Note: Start both data fetches.
        fetchWeatherData();
        fetchAqiData(); // Ashish's Note: Start the second API call

    } catch (e) {
        console.error("Map initialization failed:", e);
        updateWeatherStatus("Error: Map failed to load.", true);
    }
}

/**
 * Ashish's Note: Fetches data from the Open-Meteo WEATHER API.
 */
async function fetchWeatherData() {
    updateWeatherStatus("Loading weather data...", false);
    
    // Ashish's Note: API URL for current weather ONLY. (Removed AQI)
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${SURAT_LAT}&longitude=${SURAT_LNG}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;

    try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`Weather API failed (HTTP ${res.status})`);
        
        const data = await res.json();
        
        if (data && data.current) {
            displayWeather(data.current);
            updateWeatherStatus("Current conditions in Surat:", false);
        } else {
            throw new Error("Incomplete data from weather API.");
        }

    } catch (err) {
        console.error("Ashish's Note: Error fetching weather data:", err);
        updateWeatherStatus(err.message, true);
    }
}

/**
 * Ashish's Note: Fetches data from the Open-Meteo AIR QUALITY API.
 */
async function fetchAqiData() {
    // Ashish's Note: This is the SEPARATE API for Air Quality
    const aqiApiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${SURAT_LAT}&longitude=${SURAT_LNG}&hourly=us_aqi&timezone=auto`;
    
    try {
        const res = await fetch(aqiApiUrl);
        if (!res.ok) throw new Error(`AQI API failed (HTTP ${res.status})`);
        
        const data = await res.json();

        if (data && data.hourly && data.hourly.us_aqi) {
            displayAqi(data.hourly);
        } else {
            throw new Error("Incomplete data from AQI API.");
        }

    } catch (err) {
        console.error("Ashish's Note: Error fetching AQI data:", err);
        // Ashish's Note: Don't overwrite the main weather status, just log it.
        console.warn(err.message);
        document.getElementById('aqi-value').textContent = "N/A";
        document.getElementById('aqi-rating').textContent = "AQI data unavailable.";
    }
}


/**
 * Ashish's Note: Updates the HTML in the sidebar with the fetched WEATHER data.
 */
function displayWeather(current) {
    // Ashish's Note: Update weather card
    document.getElementById('temperature').textContent = `${current.temperature_2m}°C`;
    document.getElementById('weather-desc').textContent = getWeatherDescription(current.weather_code);
    document.getElementById('humidity').textContent = current.relative_humidity_2m;
    document.getElementById('wind-speed').textContent = current.wind_speed_10m;
}

/**
 * Ashish's Note: Updates the HTML in the sidebar with the fetched AQI data.
 */
function displayAqi(hourly) {
    // Ashish's Note: Update AQI card
    // We take the first item from the hourly AQI array as the "current" AQI
    const currentAqi = hourly.us_aqi[0]; 
    const aqiInfo = getAqiInfo(currentAqi);
    
    const aqiValueEl = document.getElementById('aqi-value');
    const aqiRatingEl = document.getElementById('aqi-rating');
    
    aqiValueEl.textContent = currentAqi;
    aqiValueEl.style.color = aqiInfo.color;
    aqiRatingEl.textContent = aqiInfo.rating;
    aqiRatingEl.style.color = aqiInfo.color;
}

/**
 * Ashish's Note: Helper to convert weather codes (WMO) to text.
 */
function getWeatherDescription(code) {
    const wmoCodes = {
        0: "Clear Sky",
        1: "Mainly Clear",
        2: "Partly Cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing Rime Fog",
        51: "Light Drizzle",
        53: "Moderate Drizzle",
        55: "Dense Drizzle",
        61: "Slight Rain",
        63: "Moderate Rain",
        65: "Heavy Rain",
        80: "Slight Rain Showers",
        81: "Moderate Rain Showers",
        82: "Violent Rain Showers",
        95: "Thunderstorm"
    };
    return wmoCodes[code] || "Unknown";
}

/**
 * Ashish's Note: Helper to convert US AQI value to a rating and color.
 */
function getAqiInfo(aqi) {
    if (aqi === null || typeof aqi === 'undefined') {
        return { rating: "Unavailable", color: "#333" };
    }
    if (aqi <= 50) {
        return { rating: "Good", color: "#28a745" }; // Green
    } else if (aqi <= 100) {
        return { rating: "Moderate", color: "#ffc107" }; // Yellow
    } else if (aqi <= 150) {
        return { rating: "Unhealthy for Sensitive Groups", color: "#fd7e14" }; // Orange
    } else if (aqi <= 200) {
        return { rating: "Unhealthy", color: "#dc3545" }; // Red
    } else if (aqi <= 300) {
        return { rating: "Very Unhealthy", color: "#842029" }; // Purple
    } else {
        return { rating: "Hazardous", color: "#842029" }; // Maroon
    }
}

/**
 * Ashish's Note: Simple status updater for the UI.
 */
function updateWeatherStatus(msg, isError = false) {
    const statusEl = document.getElementById('weather-status');
    if (statusEl) {
        statusEl.textContent = msg;
        statusEl.style.color = isError ? '#dc3545' : '#333';
        statusEl.style.fontWeight = 'bold';
    }
    console.log("Weather Status:", msg);
}

// Ashish's Note: Start the app once the page is fully loaded.
window.onload = initWeatherPage;

