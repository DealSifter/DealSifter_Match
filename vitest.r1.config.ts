import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  include: [
    'supabase/functions/_shared/maxxis/r1Evidence.vitest.test.ts',
    'supabase/functions/_shared/maxxis/dealInsightContext.test.ts',
    'supabase/functions/_shared/maxxis/canonicalEvidenceIntegration.test.ts',
    'supabase/functions/_shared/maxxis/providerEvidencePlan.vitest.test.ts',
    'supabase/functions/_shared/property-data/{marketRent.vitest,propertyEvidenceService,valuationEvidenceService,soldEvidenceService,providers,providerBudget}.test.ts',
    'src/features/maxxis/export/{reportIntegrityViewModel,referenceReportLayout,reportExampleParity,marketRentReport}.test.js',
  ], setupFiles: ['./scripts/r1-offline-test-setup.ts'], environment: 'node',
} });
