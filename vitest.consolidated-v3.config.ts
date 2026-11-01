import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  include: ['supabase/functions/_shared/property-data/singleFlight.v3.test.ts',
    'supabase/functions/_shared/maxxis/evidenceAbsence.v3.test.ts',
    'supabase/functions/_shared/public-parcel/telemetry.v3.test.ts'],
  setupFiles: ['./scripts/r1-offline-test-setup.ts'], environment: 'node', pool: 'threads', maxWorkers: 1,
} });
