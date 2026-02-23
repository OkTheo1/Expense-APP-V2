import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/truelayer-auth': {
        target: 'https://auth.truelayer.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/truelayer-auth/, ''),
      },
      '/truelayer-api': {
        target: 'https://api.truelayer.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/truelayer-api/, ''),
      },
    },
  },
})
