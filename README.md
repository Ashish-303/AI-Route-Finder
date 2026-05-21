# Smart AI Route Finder 🛣️

<div align="center">
  <img src="assets/AI route logo.png" alt="Smart AI Route Finder Logo" width="150" height="150" />
  <p><em>An intelligent, context-aware route planning web application tailored for Surat City.</em></p>
  
  [![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/Ashish-303/smart-ai-route-finder/blob/main/LICENSE)
  [![Made with HTML/CSS/JS](https://img.shields.io/badge/Made%20with-HTML%20%7C%20CSS%20%7C%20JS-f06529.svg)](https://github.com/Ashish-303)
  [![OpenRouteService](https://img.shields.io/badge/Powered%20by-OpenRouteService-red.svg)](https://openrouteservice.org/)
</div>

---

## 📖 Overview

**Smart AI Route Finder** is an advanced web application designed to move beyond standard map API services. Built as a Minor/Major Project at P.P. Savani University (PPSU), it provides optimized, context-aware route planning specifically customized for the unique traffic and environmental challenges of Surat, Gujarat.

The core innovation lies in its custom algorithmic layer, which ensures routes are not only geographically shorter but strategically faster, safer, and more efficient for users, especially during peak congestion hours.

## ✨ Key Features & AI Algorithms

### 1. Hybrid Route Optimization
Leveraging the **OpenRouteService (ORS)** to generate multiple route alternatives, our proprietary **Custom Score Function** evaluates each path based on Weighted Travel Time (WTT):
- Applies a **Congestion Penalty** for passing through known bottlenecks (e.g., Chowk Bazaar, Majura Gate).
- Automatically selects alternatives that avoid severe traffic delays.

### 2. Two-Wheeler Optimization
Recognizing the dominance of two-wheelers in Surat, the AI applies a conditional speed bonus when the "Two-Wheeler" mode is selected. It favors smaller arterial roads and shortcuts over gridlocked main roads, simulating real-world navigation capabilities.

### 3. Smart POI Sorting (Fastest ETA)
For features like **Nearby Restaurants**, **ATMs**, and **Theatres**, results are dynamically sorted by the quickest Estimated Time of Arrival (ETA) calculated via the ORS Distance Matrix—prioritizing accessibility over straight-line distance.

### 4. Safety & Environmental Awareness
Integrates proactive warnings and penalties for routes affected by high AQI, waterlogging risks, or known unsafe zones.

---

## 🛠️ Technology Stack

- **Frontend Core:** HTML5, CSS3, JavaScript (ES6+)
- **Mapping:** [Leaflet.js](https://leafletjs.com/) (Lightweight, interactive map library)
- **Routing & Geocoding:** [OpenRouteService (ORS) API](https://openrouteservice.org/), [Nominatim](https://nominatim.org/)
- **Points of Interest (POI):** [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) (OSM)
- **Data Visualization:** [Chart.js](https://www.chartjs.org/) (for dashboard analytics)

---

## 📂 Project Structure

```text
smart-ai-route-finder/
├── index.html            # Main Dashboard and Analytics
├── config.js             # AI Congestion Coordinates, API Keys & Penalties
├── pages/
│   ├── route.html        # Primary AI A->B Routing UI
│   ├── atms.html         # Smart ATM Finder UI
│   ├── restaurants.html  # Nearby Restaurants
│   ├── theatres.html     # Theatres Near You
│   ├── safety.html       # Emergency Safety Mode
│   └── weather.html      # Check Weather & AQI
├── js/
│   ├── route.js          # Core AI Logic and Custom Scoring Functions
│   └── ...               # Additional feature scripts (visitor, theme, pps-route, etc.)
├── css/
│   ├── style.css         # Modern, Responsive Base CSS
│   └── dark-mode.css     # Dark Mode Styling
├── data/
│   └── ...               # GeoJSON & Local Data
└── assets/               # Images and Icons
```

---

## 🚀 Getting Started

Follow these step-by-step instructions to run the project locally on your machine.

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge, Safari).
- An internet connection for map tiles and API requests.
- Optional but recommended: [Node.js](https://nodejs.org/) & [npm](https://npmjs.com/) (if you want to use advanced dev servers) or a simple HTTP server extension in VS Code.

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Ashish-303/Smart-AI-Route-Finder.git
   ```

2. **Navigate to the project directory:**
   ```bash
   cd Smart-AI-Route-Finder
   ```

3. **Configure API Keys:**
   - Open `config.js` in the root directory.
   - Replace the `window.ORS_API_KEY` placeholder with your own valid OpenRouteService API key if necessary (or keep the default one provided for testing).

4. **Run the Application:**
   - **Method A (VS Code):** Use the "Live Server" extension and click "Go Live" on `index.html`.
   - **Method B (Python):** If you have Python installed, run a local server:
     ```bash
     python -m http.server 8080
     ```
     Then open `http://localhost:8080` in your browser.
   - **Method C (Direct):** Alternatively, you can directly open `index.html` in your web browser.

---

## 🤝 Author & Contact

**Ashish Bavaliya**

I am passionate about creating smart, AI-driven solutions to solve real-world problems. Feel free to connect with me for collaborations, questions, or just to say hi!

- **LinkedIn:** [www.linkedin.com/in/ashish-bavaliya](https://www.linkedin.com/in/ashish-bavaliya)
- **GitHub:** [github.com/Ashish-303](https://github.com/Ashish-303)

---

> *Note: This project was built for educational and demonstration purposes. Please ensure API limits are respected when testing extensively.*
