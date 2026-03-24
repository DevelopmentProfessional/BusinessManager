import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isDev = command === 'serve'
  const buildTimestamp = new Date().toISOString()

  // Use custom cert (includes LAN IP SAN) so other devices on the network can connect
  const sslDir = path.resolve(__dirname, '../ssl')
  const sslKey = path.join(sslDir, 'key.pem')
  const sslCert = path.join(sslDir, 'cert.pem')
  const hasCustomCert = fs.existsSync(sslKey) && fs.existsSync(sslCert)

  const plugins = [react()]

  return {
    define: {
      __APP_BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
    },
    plugins,
    server: {
      // HTTPS in dev: use custom cert (LAN IP in SAN) when available, else fall back to basic ssl
      https: isDev
        ? hasCustomCert
          ? { key: fs.readFileSync(sslKey), cert: fs.readFileSync(sslCert) }
          : true
        : false,
      // Allow override via env var VITE_PORT; default to 5173
      port: Number(process.env.VITE_PORT || 5173),
      host: true,
      // Proxy API calls to the backend to avoid mixed content and CORS (development only)
      // Backend runs on HTTP internally, Vite handles the HTTPS for the browser
      proxy: {
        '/api': {
          target: process.env.VITE_API_PROXY_TARGET || 'https://businessmanager-reference-api.onrender.com',
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.error('Proxy error:', err.message);
            });
          },
        },
      },
    },
    build: {
      outDir: 'dist',
      // Target modern browsers with broad cross-platform support:
      // Chrome/Edge 88+, Firefox 78+, Safari 14+, iOS Safari 14+, Samsung Internet 14+, Opera 74+
      target: ['chrome88', 'firefox78', 'safari14', 'edge88'],
    },
    preview: {
      port: process.env.PORT || 4173,
      host: '0.0.0.0'
    }
  }
})