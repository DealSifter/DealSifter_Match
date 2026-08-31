import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'scripts/maxxis-acceptance-lib.test.js',
      'scripts/preview-environment-guard.test.js',
      'e2e/support/environment.test.js',
      'supabase/functions/_shared/maxxis/geminiErrors.test.ts',
      'supabase/functions/_shared/maxxis/geminiCandidate.test.ts',
      'supabase/functions/_shared/maxxis/providerFailureAcceptance.test.ts',
      'supabase/functions/_shared/maxxis/conversationRouting.test.ts',
      'src/components/maxxis/maxxisConversationContract.test.js',
      'src/services/maxxisFallbackPolicy.test.js',
    ],
  },
});
