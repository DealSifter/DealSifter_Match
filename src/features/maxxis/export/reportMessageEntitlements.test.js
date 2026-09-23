import { describe, expect, it } from 'vitest';
import { createReportEntitlement } from '../../../domain/intelligenceAccess';
import { withCurrentReportExportEntitlements } from './reportMessageEntitlements';

const premiumMessage = (storedEntitlements = undefined) => ({
  id: 'report-1',
  role: 'assistant',
  type: 'maxxis_deal_intelligence',
  data: {
    maxxisReport: { type: 'maxxis_report_schema', reportType: 'DEAL_INTELLIGENCE' },
    ...(storedEntitlements ? { reportExportEntitlements: storedEntitlements } : {}),
  },
});

describe('withCurrentReportExportEntitlements', () => {
  it('enables every premium report action from the current Enterprise/Admin plan', () => {
    for (const plan of ['enterprise', 'admin']) {
      const result = withCurrentReportExportEntitlements(premiumMessage(), { plan });
      expect(result.data.reportExportEntitlements).toMatchObject({
        PDF: { allowed: true },
        EMAIL: { allowed: true },
        SHARE: { allowed: true },
      });
    }
  });

  it('replaces stale denied decisions with a current legitimate entitlement', () => {
    const stale = { PDF: { allowed: false }, EMAIL: { allowed: false }, SHARE: { allowed: false } };
    const entitlement = createReportEntitlement({
      reportType: 'DEAL_INTELLIGENCE',
      accessSource: 'NUGGET_UNLOCK',
      expires: '2030-01-01',
    });
    const result = withCurrentReportExportEntitlements(premiumMessage(stale), {
      plan: 'free',
      entitlements: [entitlement],
    });
    expect(Object.values(result.data.reportExportEntitlements).every((decision) => decision.allowed)).toBe(true);
  });

  it('keeps premium actions denied without a legitimate current grant', () => {
    const result = withCurrentReportExportEntitlements(premiumMessage(), { plan: 'free' });
    expect(Object.values(result.data.reportExportEntitlements).every((decision) => !decision.allowed)).toBe(true);
  });
});
