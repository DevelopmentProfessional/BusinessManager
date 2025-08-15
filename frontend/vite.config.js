import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Allow override via env var VITE_PORT; default to 5173
    port: Number(process.env.VITE_PORT || 5173),
    host: true
  },
  build: {
    outDir: 'dist'
  }
})
