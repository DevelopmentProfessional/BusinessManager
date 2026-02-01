import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const plugins = [react()]
  
  // Load SSL certificates for local HTTPS
  const sslDir = path.resolve(__dirname, '../ssl')
  const keyPath = path.join(sslDir, 'key.pem')
  const certPath = path.join(sslDir, 'cert.pem')
  
  // Check if certificates exist
  const hasSSL = fs.existsSync(keyPath) && fs.existsSync(certPath)

  return {
    plugins,
    server: {
      // HTTPS enabled with our self-signed certificate
      https: hasSSL ? {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      } : true,
      // Allow override via env var VITE_PORT; default to 5173
      port: Number(process.env.VITE_PORT || 5173),
      host: true,
      // Proxy API calls to the backend to avoid mixed content and CORS (development only)
      // Backend runs on HTTP internally, Vite handles the HTTPS for the browser
      proxy: {
        '/api': {
          target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, res) => {
              console.error('Proxy error:', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Proxying request:', req.method, req.url);
            });
          },
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
  }
})