import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "react-datepicker/dist/react-datepicker.css";
import "./index.css";

// Unregister any service workers left from previous builds
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}

// Clear any workbox / PWA caches left from previous builds
if ("caches" in window) {
  window.caches.keys().then((keys) => {
    keys.forEach((key) => window.caches.delete(key));
  });
}

// Auto-recover when a chunk fails to load after a deployment (Vite preload error)
const handleChunkError = () => {
  const lastReload = sessionStorage.getItem("last_chunk_reload");
  const now = Date.now();
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    sessionStorage.setItem("last_chunk_reload", String(now));
    window.location.reload();
  }
};

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  handleChunkError();
});

window.addEventListener("error", (event) => {
  const msg = String(event?.message || "");
  if (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module")
  ) {
    handleChunkError();
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
