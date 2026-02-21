import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Always enable HTTPS in dev so phones on the LAN can use the camera (requires secure context)
  const isDev = command === 'serve'

  const plugins = [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'Business Manager',
        short_name: 'BizManager',
        description: 'Business Management System',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#3B82F6',
        icons: [
          {
            src: '/vite.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ]

  if (isDev) {
    plugins.push(basicSsl())
  }

  return {
    plugins,
    server: {
      // HTTPS always enabled in dev so phones on the LAN can access the camera (secure context required)
      https: isDev,
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