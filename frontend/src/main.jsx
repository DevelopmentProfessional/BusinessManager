import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

const pwaEnabled = import.meta.env.VITE_ENABLE_PWA !== 'false'

if (pwaEnabled) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true)
    },
  })

  window.forceServiceWorkerRefresh = async () => {
    if (!('serviceWorker' in navigator)) {
      window.location.reload()
      return
    }

    try {
      if (typeof updateSW === 'function') {
        updateSW(true)
      }

      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.update()))

      if (registrations.length === 0) {
        await navigator.serviceWorker.register('/sw.js')
      }
    } catch {
      // Best effort only; reload still proceeds.
    }

    window.location.reload()
  }
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister()
    })
  })

  if ('caches' in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => {
        if (key.toLowerCase().includes('workbox') || key.toLowerCase().includes('pwa')) {
          caches.delete(key)
        }
      })
    })
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
