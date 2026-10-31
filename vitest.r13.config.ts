import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'node',pool:'threads',maxWorkers:1,testTimeout:30000,
 setupFiles:['./scripts/r1-offline-test-setup.ts'],include:[
 'supabase/functions/_shared/property-data/{providerTrace,usageGuard,providerBudget,providers,valuationProvider,soldProvider,supplementalEvidenceProvider,marketRent.vitest,propertyEvidenceService,valuationEvidenceService,soldEvidenceService}.test.ts',
 'supabase/functions/_shared/maxxis/{r1Evidence.vitest,canonicalEvidenceIntegration}.test.ts',
]}});
