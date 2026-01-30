import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const plugins = [react()]

  return {
    plugins,
    server: {
      // HTTPS disabled by default for simpler development
      https: false,
      // Allow override via env var VITE_PORT; default to 5173
      port: Number(process.env.VITE_PORT || 5173),
      host: true,
      // Proxy API calls to the backend to avoid mixed content and CORS (development only)
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