/* global process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { sentryVitePlugin } from '@sentry/vite-plugin'

/** Vercel often sets SUPABASE_* without VITE_ — merge both for the client bundle. */
function resolveBuildEnv(mode) {
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
    VITE_APP_ENVIRONMENT: pick('VITE_APP_ENVIRONMENT', 'VERCEL_ENV') || mode,
    VITE_APP_RELEASE: pick('VITE_APP_RELEASE', 'VERCEL_GIT_COMMIT_SHA') || pick('GITHUB_SHA', '') || 'local',
    SENTRY_AUTH_TOKEN: pick('SENTRY_AUTH_TOKEN', ''),
    SENTRY_ORG: pick('SENTRY_ORG', ''),
    SENTRY_PROJECT: pick('SENTRY_PROJECT', ''),
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const buildEnv = resolveBuildEnv(mode)
  const sentryUploadEnabled = mode === 'production'
    && Boolean(buildEnv.SENTRY_AUTH_TOKEN && buildEnv.SENTRY_ORG && buildEnv.SENTRY_PROJECT)
    && buildEnv.VITE_APP_RELEASE !== 'local'
  const plugins = [
    react(),
    legacy({
      // iOS/iPadOS Safari legacy fallback
      targets: ['defaults', 'safari >= 11', 'ios >= 11'],
      modernPolyfills: true,
    }),
  ]

  if (sentryUploadEnabled) {
    plugins.push(sentryVitePlugin({
      authToken: buildEnv.SENTRY_AUTH_TOKEN,
      org: buildEnv.SENTRY_ORG,
      project: buildEnv.SENTRY_PROJECT,
      telemetry: false,
      release: {
        name: buildEnv.VITE_APP_RELEASE,
        deploy: { env: buildEnv.VITE_APP_ENVIRONMENT },
      },
      sourcemaps: {
        assets: './dist/**',
        filesToDeleteAfterUpload: './dist/**/*.map',
      },
    }))
  }

  return {
  plugins,
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(buildEnv.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(buildEnv.VITE_SUPABASE_ANON_KEY),
    'import.meta.env.VITE_APP_URL': JSON.stringify(buildEnv.VITE_APP_URL),
    'import.meta.env.VITE_APP_ENVIRONMENT': JSON.stringify(buildEnv.VITE_APP_ENVIRONMENT),
    'import.meta.env.VITE_APP_RELEASE': JSON.stringify(buildEnv.VITE_APP_RELEASE),
  },
  build: {
    // The legacy plugin owns JavaScript targets; cssTarget retains old Safari CSS output.
    cssTarget: 'safari13',
    manifest: true,
    sourcemap: sentryUploadEnabled ? 'hidden' : false,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/i18n/translations.js')) return 'i18n-data';
          if (id.includes('/src/data/mockData.js')) return 'catalog-data';
          if (!id.includes('node_modules')) return;

          if (id.includes('/react/') || id.includes('react-dom')) return 'react-vendor';
          if (id.includes('@supabase')) return 'supabase-vendor';
          if (id.includes('@sentry')) return 'observability-vendor';
          if (id.includes('lucide-react')) return 'icons-vendor';
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
  test: {
    include: [
      'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
      'supabase/functions/_shared/**/*.{test,spec}.{js,jsx,ts,tsx}',
    ],
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
  },
  }
})
