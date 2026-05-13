import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('/react/') || id.includes('react-dom')) return 'react-vendor';
          if (id.includes('@supabase')) return 'supabase-vendor';
          if (id.includes('leaflet') || id.includes('react-leaflet') || id.includes('supercluster')) return 'map-vendor';
          if (id.includes('jspdf')) return 'pdf-vendor';
          if (id.includes('localforage')) return 'storage-vendor';
          if (id.includes('framer-motion')) return 'motion-vendor';
        },
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    watch: {
      // Set VITE_USE_POLLING=false in .env to disable on Linux/Mac CI.
      usePolling: process.env.VITE_USE_POLLING !== 'false',
      interval: 100
    }
    // Optional: tune HMR if you use a non-default port or proxy
    // hmr: { port: 5173 }
  }
})
