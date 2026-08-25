import { expect } from '@playwright/test';
import { openMatches, selectBaselineProperty } from './baselineActions.js';
import { openMaxxis } from './appActions.js';

export async function primeMaxxisDealMemory(page, { userId, propertyId, serviceId }) {
  await page.addInitScript(({ accountId, dealId, providerId }) => {
    localStorage.setItem('ds_feature_flag_overrides', JSON.stringify({ maxxis_deal_memory: true }));
    localStorage.setItem('lang', 'en');
    localStorage.setItem(`ds_maxxis_deal_memory_v1:${accountId}`, JSON.stringify({
      version: 1,
      updatedAt: '2026-08-24T10:00:00.000Z',
      memories: {
        [dealId]: {
          memoryVersion: 1,
          propertyId: dealId,
          lastReviewedAt: '2026-08-24T10:00:00.000Z',
          expiresAt: '2026-11-22T10:00:00.000Z',
          lastInteractionType: 'DEAL_REVIEW',
          lastKnownDealState: 'ACTIVE',
          lastKnownWorkflowProgress: {
            completed: 0,
            total: 3,
            pendingCodes: ['INSPECTION_COMPLETED', 'PROVIDER_REPLIED', 'REHAB_QUOTE_RECEIVED'],
          },
          lastKnownGapCodes: [
            `PROVIDER_CONTACT_LOCKED_${providerId}`,
            'WORKFLOW_PENDING_INSPECTION_COMPLETED',
            'WORKFLOW_PENDING_PROVIDER_REPLIED',
            'WORKFLOW_PENDING_REHAB_QUOTE_RECEIVED',
          ],
          lastKnownProviderServiceIds: [providerId],
          lastKnownContactAccessStates: [{ serviceId: providerId, status: 'LOCKED' }],
          lastKnownConversationState: 'NO_CONVERSATION',
          lastKnownNextBestActionCode: 'REVIEW_WORKFLOW',
          lastKnownMetricAvailability: ['ACQUISITION_PLUS_REHAB', 'CAP_RATE', 'PRICE_PER_SQFT'],
          lastKnownAdvisorAttentionCodes: [],
        },
      },
    }));
  }, { accountId: userId, dealId: propertyId, providerId: serviceId });
}

export async function openDealAndRecallMemory(page, { selectDeal = true } = {}) {
  if (selectDeal) {
    await openMatches(page);
    await selectBaselineProperty(page);
  }
  await openMaxxis(page);
  await page.getByTestId('maxxis-input').fill('Where were we?');
  const response = page.waitForResponse((item) => item.url().includes('/functions/v1/maxxis-chat'));
  await page.getByTestId('maxxis-send').click({ force: true });
  await response;
  await expect(page.getByTestId('maxxis-composed-memory_recall')).toBeVisible();
}
