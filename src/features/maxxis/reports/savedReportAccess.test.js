import { describe, expect, it } from 'vitest';
import { resolveSavedReportAccessDecision } from './savedReportAccess';

const savedReport = (accessSource = 'SUBSCRIPTION_INCLUDED') => ({
  id: 'report-1',
  capability: 'DEAL_INTELLIGENCE',
  accessSource,
  reportPayload: { data: { maxxisReport: { reportType: 'DEAL_INTELLIGENCE' } } },
});

describe('saved Maxxis report access', () => {
  it.each([
    ['SUBSCRIPTION_INCLUDED', 'SUBSCRIPTION', 'ENTERPRISE'],
    ['ONE_TIME_UNLOCK', 'NUGGET_UNLOCK', 'NUGGET_UNLOCK'],
  ])('restores owned %s artifact access for view and delivery actions', (source, accessSource, accessLevel) => {
    expect(resolveSavedReportAccessDecision(savedReport(source))).toMatchObject({
      allowed: true, reportType: 'DEAL_INTELLIGENCE', accessSource, accessLevel,
    });
  });

  it('fails closed when the persisted capability and report schema disagree', () => {
    const report = savedReport();
    report.reportPayload.data.maxxisReport.reportType = 'MAXXIS_ANALYSIS';
    expect(resolveSavedReportAccessDecision(report)).toBeNull();
  });
});
