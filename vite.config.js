import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/** Vercel often sets SUPABASE_* without VITE_ — merge both for the client bundle. */
function resolvePublicEnv(mode) {
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const pick = (viteKey, legacyKey) =>
    String(
      process.env[viteKey] ||
      process.env[legacyKey] ||
      fileEnv[viteKey] ||
      fileEnv[legacyKey] ||
      '',
    ).trim()

  return {
    VITE_SUPABASE_URL: pick('VITE_SUPABASE_URL', 'SUPABASE_URL'),
    VITE_SUPABASE_ANON_KEY: pick('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'),
    VITE_APP_URL: pick('VITE_APP_URL', 'APP_URL'),
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const publicEnv = resolvePublicEnv(mode)

  return {
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(publicEnv.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(publicEnv.VITE_SUPABASE_ANON_KEY),
    'import.meta.env.VITE_APP_URL': JSON.stringify(publicEnv.VITE_APP_URL),
  },
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
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    watch: {
      // Set VITE_USE_POLLING=false in .env to disable on Linux/Mac CI.
      usePolling: process.env.VITE_USE_POLLING !== 'false',
      interval: 100
    },
    // Optional: tune HMR if you use a non-default port or proxy
    // hmr: { port: 5173 }
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
  },
  }
})
