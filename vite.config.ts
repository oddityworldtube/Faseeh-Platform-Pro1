
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // هذا السطر مهم جداً لضمان عمل التطبيق على GitHub Pages
  // يجعل المسارات نسبية بدلاً من مطلقة
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  define: {
    // Safely expose only the API_KEY to the client, preserving other env vars like NODE_ENV.
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
  }
})
