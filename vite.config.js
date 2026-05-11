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
        },
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    watch: {
      // For Windows and network drives, force polling so file changes are reliably detected.
      usePolling: true,
      interval: 100
    }
    // Optional: tune HMR if you use a non-default port or proxy
    // hmr: { port: 5173 }
  }
})
