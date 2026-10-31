import { defineConfig } from 'vitest/config';
export default defineConfig({ esbuild: { jsx: 'automatic' }, test: {
  include: ['src/features/maxxis/export/*.test.{js,ts}', 'src/features/maxxis/intelligence/MaxxisCanonicalReportPreview.test.jsx',
    'src/domain/maxxis/maxxisReportSchema.test.js', 'src/features/maxxis/qa/maxxisProductionReadiness.test.js', 'src/services/propertyIntelligenceService.test.js',
    'src/components/matches/propertyReleaseExport.test.js', 'src/features/maxxis/reports/{reportJourney,liveIntelligencePipeline}.contract.test.js'],
  setupFiles: ['./scripts/r1-offline-test-setup.ts'], environment: 'node', pool: 'threads', maxWorkers: 1, testTimeout: 30000,
} });
