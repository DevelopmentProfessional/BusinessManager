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
      const nextUrl = new URL(window.location.href)
      nextUrl.searchParams.set('__sync', String(Date.now()))
      window.location.replace(nextUrl.toString())
      return
    }

    try {
      const registrations = await navigator.serviceWorker.getRegistrations()

      if (typeof updateSW === 'function') {
        updateSW(true)
      }

      await Promise.all(registrations.map((registration) => registration.update()))

      await Promise.all(registrations.map((registration) => registration.unregister()))

      if ('caches' in window) {
        const cacheKeys = await caches.keys()
        await Promise.all(
          cacheKeys.map((key) => {
            const normalized = key.toLowerCase()
            if (normalized.includes('workbox') || normalized.includes('pwa') || normalized.includes('precache')) {
              return caches.delete(key)
            }
            return Promise.resolve(false)
          })
        )
      }

      await fetch(`/sw.js?sync=${Date.now()}`, { cache: 'no-store' }).catch(() => undefined)
    } catch {
      // Best effort only; reload still proceeds.
    }

    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.set('__sync', String(Date.now()))
    window.location.replace(nextUrl.toString())
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
