import { defineConfig } from 'vitest/config';
export default defineConfig({ esbuild: { jsx: 'automatic' }, test: {
  include: [
    'supabase/functions/_shared/maxxis/r12Gaps.test.ts',
    'supabase/functions/_shared/maxxis/{financialEvidence,dealDecisionContext,maxxisStructuredAnalysis}.vitest.test.ts',
    'supabase/functions/_shared/property-data/arvEngine.test.ts',
    'src/features/maxxis/intelligence/{MaxxisAnalysisGapResolution.interaction,analysisGapAnswer,maxxisGapSubmissionRegression,confirmParsedAnalysisInputs}.test.{js,jsx}',
    'src/features/maxxis/export/{reportIntegrityViewModel,marketRentReport,r12ArvPolicy}.test.js',
  ], setupFiles: ['./scripts/r1-offline-test-setup.ts'], environment: 'node',
  pool: 'threads', maxWorkers: 1, testTimeout: 30000,
} });
