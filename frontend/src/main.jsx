import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './index.css'

// Strip the cache-bust param added by runAppSync so it doesn't linger in the URL
if (typeof window !== 'undefined') {
  const url = new URL(window.location.href)
  if (url.searchParams.has('_r')) {
    url.searchParams.delete('_r')
    window.history.replaceState({}, '', url.toString())
  }
}

// Unregister any service workers left from previous builds
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister())
  })
}

// Clear any workbox / PWA caches left from previous builds
if ('caches' in window) {
  caches.keys().then((keys) => {
    keys.forEach((key) => caches.delete(key))
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
