/* global process */
import { getE2ERunId } from '../support/environment.js';

export const E2E_RUN_ID = getE2ERunId();

export const E2E_IDS = {
  investorUser: '11111111-1111-4111-8111-111111111111',
  providerUser: '22222222-2222-4222-8222-222222222222',
  incompleteUser: '33333333-3333-4333-8333-333333333333',
  noNuggetsUser: '44444444-4444-4444-8444-444444444444',
  property: '55555555-5555-4555-8555-555555555555',
  providerService: '66666666-6666-4666-8666-666666666666',
  unlockIntent: '77777777-7777-4777-8777-777777777777',
  messageAction: '88888888-8888-4888-8888-888888888888',
};

export const E2E_USERS = {
  investor: {
    id: E2E_IDS.investorUser,
    email: process.env.E2E_INVESTOR_EMAIL || `investor+${E2E_RUN_ID}@example.test`,
    password: process.env.E2E_INVESTOR_PASSWORD || 'E2E-investor-pass-2026',
    fullName: `E2E Investor ${E2E_RUN_ID}`,
    nuggets: 20,
    accountType: 'investor',
  },
  provider: {
    id: E2E_IDS.providerUser,
    email: process.env.E2E_PROVIDER_EMAIL || `provider+${E2E_RUN_ID}@example.test`,
    password: process.env.E2E_PROVIDER_PASSWORD || 'E2E-provider-pass-2026',
    fullName: `E2E Provider ${E2E_RUN_ID}`,
    nuggets: 8,
    accountType: 'contractor',
  },
  incomplete: {
    id: E2E_IDS.incompleteUser,
    email: process.env.E2E_INCOMPLETE_EMAIL || `incomplete+${E2E_RUN_ID}@example.test`,
    password: process.env.E2E_INCOMPLETE_PASSWORD || 'E2E-incomplete-pass-2026',
    fullName: '',
    nuggets: 3,
    accountType: 'buyer',
  },
  noNuggets: {
    id: E2E_IDS.noNuggetsUser,
    email: process.env.E2E_NO_NUGGETS_EMAIL || `nonuggets+${E2E_RUN_ID}@example.test`,
    password: process.env.E2E_NO_NUGGETS_PASSWORD || 'E2E-nonuggets-pass-2026',
    fullName: `E2E No Nuggets ${E2E_RUN_ID}`,
    nuggets: 0,
    accountType: 'investor',
  },
};
