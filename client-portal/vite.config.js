import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    port: 5174,
    proxy: {
      // Proxy client-api calls during local development
      '/api/client': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          stripe: ['@stripe/stripe-js', '@stripe/react-stripe-js'],
          calendar: ['react-big-calendar', 'date-fns'],
        },
      },
    },
  },
})
