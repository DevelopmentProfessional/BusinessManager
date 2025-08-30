import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), mkcert()],
  server: {
    // HTTPS for camera access on LAN and localhost (can be disabled via VITE_HTTPS=false)
    https: String(process.env.VITE_HTTPS ?? 'true').toLowerCase() !== 'false',
    // Allow override via env var VITE_PORT; default to 5173
    port: Number(process.env.VITE_PORT || 5173),
    host: true,
    // Proxy API calls to the backend to avoid mixed content and CORS (development only)
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist'
  },
  preview: {
    port: process.env.PORT || 4173,
    host: '0.0.0.0'
  }
})
