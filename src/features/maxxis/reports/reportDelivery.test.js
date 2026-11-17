import { webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createReportDeliveryReference, resolveReportDelivery, reportEmailDraft, reportSnapshotFingerprint, savePendingReportDelivery, readPendingReportDelivery, clearPendingReportDelivery } from './reportDelivery';
vi.stubGlobal('crypto', webcrypto);
const fixture = (type = 'DEAL_INTELLIGENCE') => ({ id: 'report-a', userId: 'a', propertyId: 'property-a', capability: type,
  accessSource: 'SUBSCRIPTION_INCLUDED', reportVersion: '1', reportPayload: { data: {
    analysisRequest: { id: 'request-a', propertyId: 'property-a', reportType: type, scenarioVersion: 7, language: 'en' },
    maxxisReport: { reportType: type, sections: { propertySummary: { data: { id: 'property-a' } } }, presentation: { activeScenario: { id: 'scenario-a', version: 7 } } },
  } } });
describe('R3.2 saved-artifact delivery contract', () => {
  it('restores only the same account delivery reference after reload, without copying a private snapshot', async () => {
    const values = new Map(); vi.stubGlobal('sessionStorage', { setItem: (key, value) => values.set(key, value), getItem: key => values.get(key), removeItem: key => values.delete(key) });
    const ref = await createReportDeliveryReference(fixture(), 'a'); savePendingReportDelivery(ref);
    expect(readPendingReportDelivery('a')).toEqual(ref); expect(readPendingReportDelivery('b')).toBeNull();
    expect([...values.values()][0]).not.toContain('maxxisReport'); clearPendingReportDelivery('a'); expect(readPendingReportDelivery('a')).toBeNull();
  });
  it.each(['MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'])('reuses an authorized %s without generation or unlock', async type => {
    const report = fixture(type), ref = await createReportDeliveryReference(report, 'a');
    const read = vi.fn().mockResolvedValue(report);
    const result = await resolveReportDelivery(ref, 'a', read);
    expect(read).toHaveBeenCalledExactlyOnceWith('report-a', 'a');
    expect(result.schema).toBe(report.reportPayload.data.maxxisReport);
    expect(result.entitlements.PDF.allowed).toBe(true); expect(ref.scenarioVersion).toBe(7);
  });
  it('hashes JSONB key ordering consistently', async () => {
    expect(await reportSnapshotFingerprint({ a: 1, b: { c: 2, d: 3 } })).toBe(await reportSnapshotFingerprint({ b: { d: 3, c: 2 }, a: 1 }));
  });
  it.each(['propertyId', 'capability', 'reportVersion'])('rejects changed backend %s', async field => {
    const report = fixture(), ref = await createReportDeliveryReference(report, 'a');
    const changed = structuredClone(report); changed[field] = 'other';
    await expect(resolveReportDelivery(ref, 'a', async () => changed)).rejects.toThrow(/CONTEXT_MISMATCH|STALE/);
  });
  it('rejects overwritten snapshot even when report ID is reused', async () => {
    const report = fixture(), ref = await createReportDeliveryReference(report, 'a');
    report.reportPayload.data.maxxisReport.presentation.activeScenario.version = 8;
    await expect(resolveReportDelivery(ref, 'a', async () => report)).rejects.toThrow('STALE');
  });
  it('rejects foreign account before reading private data', async () => {
    const ref = await createReportDeliveryReference(fixture(), 'a'), read = vi.fn();
    await expect(resolveReportDelivery(ref, 'b', read)).rejects.toThrow('UNAUTHORIZED'); expect(read).not.toHaveBeenCalled();
  });
  it('rejects missing persisted authorization', async () => {
    const report = fixture(), ref = await createReportDeliveryReference(report, 'a'); report.accessSource = 'UNVERIFIED';
    await expect(resolveReportDelivery(ref, 'a', async () => report)).rejects.toThrow('UNAUTHORIZED');
  });
  it('rejects unpersisted reports', async () => {
    await expect(createReportDeliveryReference({ ...fixture(), id: null }, 'a')).rejects.toThrow('CONTEXT_MISMATCH');
  });
  it('draft carries recipient only, no sender, private narrative or claimed attachment', () => {
    const url = reportEmailDraft({ to: 'qa@example.invalid', cc: 'copy@example.invalid', reportType: 'DEAL_INTELLIGENCE', reportId: 'report-a' });
    expect(url).toContain('mailto:qa%40example.invalid'); expect(url).toContain('L3');
    const params = new URL(url).searchParams;
    expect(params.has('from')).toBe(false); expect(params.has('reply-to')).toBe(false);
    expect(params.get('body')).toContain('Manually attach'); expect(params.has('attachment')).toBe(false);
  });
  it('uses Outlook-compatible RFC6068 escaping and omits empty copy headers', () => {
    const uri = reportEmailDraft({ to: 'qa+alias@example.invalid', reportType: 'DEAL_INTELLIGENCE', reportId: 'report-a' });
    expect(uri).not.toContain('+'); expect(uri).toContain('qa%2Balias%40example.invalid');
    expect(uri).not.toContain('cc='); expect(uri).not.toContain('bcc=');
    expect(uri).toContain('DealSifter%20%C2%B7%20L3%20report'); expect(uri).toContain('%0D%0A');
    const populated = new URL(reportEmailDraft({ to: 'qa@example.invalid', cc: 'copy@example.invalid', bcc: 'hidden@example.invalid' })).searchParams;
    expect(populated.get('cc')).toBe('copy@example.invalid'); expect(populated.get('bcc')).toBe('hidden@example.invalid');
  });
  it.each(['bad', 'qa@example.invalid\r\nBcc:attacker@example.invalid', 'qa@example.invalid?subject=bad', Array(12).fill('qa@example.invalid').join(',')])('rejects malformed or excessive recipient %s', to => {
    expect(() => reportEmailDraft({ to })).toThrow('INVALID_RECIPIENT');
  });
});
