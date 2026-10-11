import { defineConfig, loadEnv } from 'vite';

// Same unit-suite scope as vite.config.js, without production-only bundling plugins.
const env = loadEnv('test', process.cwd(), 'VITE_');
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  define: Object.fromEntries(Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])),
  test: {
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}', 'supabase/functions/_shared/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**', 'e2e/**', 'supabase/functions/_shared/maxxis/dealInsightInput.test.ts',
      'supabase/functions/_shared/maxxis/propertyAnalysisIntent.test.ts'],
    pool: 'forks', maxWorkers: 2, testTimeout: 30000, hookTimeout: 30000,
  },
});
