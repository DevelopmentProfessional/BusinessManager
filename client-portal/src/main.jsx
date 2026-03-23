import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Apply updates as soon as a new worker is available.
    updateSW(true)
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
