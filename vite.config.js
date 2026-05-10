import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
