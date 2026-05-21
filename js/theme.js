// js/theme.js
// Ashish's Note: Handles both mobile view detection and light/dark theme switching.

// --- 1. Mobile View Logic (Keeping existing functions) ---

function enableMobileView() {
  // Ashish's Note: Add class to body for mobile-specific styling.
  document.body.classList.add("mobile-view");
  // Ashish's Note: Hide the mobile detection popup after confirmation.
  const popup = document.getElementById("mobilePopup");
  if (popup) {
    popup.style.display = "none";
  }
}

function closePopup() {
  // Ashish's Note: Close the mobile detection popup.
  const popup = document.getElementById("mobilePopup");
  if (popup) {
    popup.style.display = "none";
  }
}

// --- 2. Theme Switching Logic ---

/**
 * Ashish's Note: Loads the theme preference from localStorage and applies it.
 */
function loadTheme() {
  const currentTheme = localStorage.getItem('theme');
  if (currentTheme === 'dark') {
    document.body.classList.add('dark-mode');
  }
  // Ashish's Note: If not 'dark', default (light mode) is used.
}

/**
 * Ashish's Note: Toggles the theme between light and dark and saves preference.
 * This function should be linked to a button's onclick event in the UI (e.g., settings.html).
 */
window.toggleTheme = function() { 
  document.body.classList.toggle('dark-mode');

  if (document.body.classList.contains('dark-mode')) {
    localStorage.setItem('theme', 'dark');
  } else {
    localStorage.setItem('theme', 'light');
  }
};


// --- 3. Initialization ---

window.onload = function () {
  // Ashish's Note: Load the saved theme preference first.
  loadTheme();

  // Ashish's Note: Display mobile popup only if on a recognized mobile device.
  const mobilePopup = document.getElementById("mobilePopup");
  if (/Mobi|Android/i.test(navigator.userAgent) && mobilePopup) {
    mobilePopup.style.display = "flex";
  }
};

// Ashish's Note: Expose functions to global scope for use in HTML (index.html, settings.html).
window.enableMobileView = enableMobileView;
window.closePopup = closePopup;
