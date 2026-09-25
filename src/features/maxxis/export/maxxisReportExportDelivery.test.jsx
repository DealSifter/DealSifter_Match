import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { MaxxisReportExportActions } from './MaxxisReportExportActions';
import { buildReportMailtoUrl } from './reportDeliveryUtils';
import { createReportEmailRequest, createSharedReport } from './maxxisReportDeliveryContracts';
import { buildMaxxisReportExportPreview } from './maxxisReportExportPreview';
import { renderMaxxisReportDocument } from './maxxisReportRenderer';
import { renderMaxxisReportPdf, renderMaxxisReportPdfCached } from './maxxisReportPdf';
import { resolveReportExportEntitlement, resolveReportExportEntitlements } from './reportExportEntitlement';

const property = { id: 'property-1', address: '100 Stored St', type: 'SFR', objective: 'Fix and Flip', images: ['https://portfolio.example/subject.jpg'] };
const analysis = { executiveSummary: 'Evidence summary.', profileAlignment: { score: 70 }, riskAwareness: [], limitations: ['Condition unknown'], nextSteps: ['Verify condition'], provenance: { property: 'USER_PROVIDED' } };
const intelligence = { executiveDealOverview: 'Evidence overview.', investmentFit: { score: 70 }, propertyEvidence: { verifiedRecords: [], userProvided: [], unknown: [{ field: 'condition' }], conflicts: [] }, valuationIntelligence: { status: 'ARV_UNAVAILABLE' }, comparableEvidence: { used: [], supporting: [], excluded: [] }, riskAnalysis: [], limitations: ['Condition unknown'], nextVerificationSteps: ['Verify condition'], provenance: { propertyEvidence: 'PROPERTY_INTELLIGENCE' } };
const schema = (reportType) => buildMaxxisReportSchema({ reportType, property, maxxisAnalysis: analysis, dealIntelligence: intelligence });
const entitlement = (plan, reportType, channel) => resolveReportExportEntitlement({ plan, reportType, channel });

describe('Maxxis Report Export + Delivery Experience v1', () => {
  it('allows Free Property Release and denies premium exports fail-closed', () => {
    expect(entitlement('free', 'PROPERTY_RELEASE', 'PDF')).toMatchObject({ allowed: true, state: 'AUTHORIZED' });
    expect(entitlement('free', 'MAXXIS_ANALYSIS', 'PDF')).toMatchObject({ allowed: false, state: 'AVAILABLE_WITH_UPGRADE' });
    expect(entitlement('free', 'DEAL_INTELLIGENCE', 'PDF').allowed).toBe(false);
  });

  it('allows Pro Maxxis Analysis, denies Deal Intelligence, and allows every Enterprise level', () => {
    expect(entitlement('pro', 'MAXXIS_ANALYSIS', 'PDF').allowed).toBe(true);
    expect(entitlement('pro', 'DEAL_INTELLIGENCE', 'PDF').allowed).toBe(false);
    for (const type of ['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE']) expect(entitlement('enterprise', type, 'PDF').allowed).toBe(true);
  });

  it('keeps a legitimate just-issued report grant attached to all local delivery actions', () => {
    const grantedAccessDecision = {
      allowed: true,
      reportType: 'DEAL_INTELLIGENCE',
      reason: 'ACTIVE_REPORT_ENTITLEMENT',
      accessLevel: 'NUGGET_UNLOCK',
      accessSource: 'NUGGET_UNLOCK',
    };
    const decisions = resolveReportExportEntitlements({
      plan: 'free',
      reportType: 'DEAL_INTELLIGENCE',
      grantedAccessDecision,
    });
    expect(Object.values(decisions).every((decision) => decision.allowed)).toBe(true);
    expect(decisions.PDF).toMatchObject({ state: 'AUTHORIZED', accessSource: 'NUGGET_UNLOCK' });
    expect(resolveReportExportEntitlements({
      plan: 'free',
      reportType: 'MAXXIS_ANALYSIS',
      grantedAccessDecision,
    }).PDF.allowed).toBe(false);
  });

  it('builds a functional encoded email draft target', () => {
    expect(buildReportMailtoUrl({ subject: 'Deal & report', body: 'PDF pronto / ready' }))
      .toBe('mailto:?subject=Deal%20%26%20report&body=PDF%20pronto%20%2F%20ready');
  });

  it('prepares an auditable document structure without producing a binary or URL', () => {
    const result = renderMaxxisReportDocument({ schema: schema('DEAL_INTELLIGENCE'), exportEntitlement: entitlement('enterprise', 'DEAL_INTELLIGENCE', 'PDF'), generatedAt: '2026-09-14T12:00:00.000Z', language: 'pt' });
    expect(result).toMatchObject({ state: 'PREPARED', document: { reportType: 'DEAL_INTELLIGENCE', language: 'pt', pageCount: 6, binary: null, downloadUrl: null } });
    expect(result.document.cover).toMatchObject({ propertyAddress: '100 Stored St', propertyType: 'SFR', strategy: 'Fix and Flip', heroImage: 'https://portfolio.example/subject.jpg' });
    expect(result.document.pages[0]).toMatchObject({ header: { brand: 'DealSifter Match', product: 'MAXXIS DEAL INTELLIGENCE REPORT' }, footer: { page: 1, generatedAt: '2026-09-14T12:00:00.000Z' } });
    expect(Object.keys(result.document.pages[0].footer)).toEqual(['page', 'generatedAt']);
  });

  it.each([
    ['free', 'PROPERTY_RELEASE', 1],
    ['pro', 'MAXXIS_ANALYSIS', 3],
    ['enterprise', 'DEAL_INTELLIGENCE', 6],
  ])('renders a physical %s PDF with exactly %i pages', async (plan, reportType, expectedPages) => {
    const result = await renderMaxxisReportPdf({
      schema: schema(reportType),
      exportEntitlement: entitlement(plan, reportType, 'PDF'),
      generatedAt: '2026-09-15T12:00:00.000Z',
    });
    expect(result).toMatchObject({ state: 'RENDERED', document: { pageCount: expectedPages, mimeType: 'application/pdf' } });
    expect(result.document.binary.byteLength).toBeGreaterThan(1000);
    expect(new TextDecoder('latin1').decode(result.document.binary.slice(0, 8))).toContain('%PDF-');
  });

  it('shares one in-flight PDF render between the chat preview and export action', async () => {
    const reportSchema = schema('MAXXIS_ANALYSIS');
    const options = {
      schema: reportSchema,
      exportEntitlement: entitlement('pro', 'MAXXIS_ANALYSIS', 'PDF'),
      generatedAt: '2026-09-15T12:00:00.000Z',
    };
    const previewRender = renderMaxxisReportPdfCached(options);
    const exportRender = renderMaxxisReportPdfCached(options);
    expect(exportRender).toBe(previewRender);
    await expect(exportRender).resolves.toMatchObject({ state: 'RENDERED', document: { pageCount: 3 } });
  });

  it('attaches the temporary download link before clicking for browser compatibility', () => {
    const source = readFileSync(new URL('./maxxisReportPdf.js', import.meta.url), 'utf8');
    expect(source).toContain('window.document.body.appendChild(anchor)');
    expect(source).toContain('anchor.click()');
    expect(source).toContain('anchor.remove()');
  });

  it('refuses mismatched or missing export entitlement without returning document content', () => {
    expect(renderMaxxisReportDocument({ schema: schema('DEAL_INTELLIGENCE'), exportEntitlement: entitlement('pro', 'DEAL_INTELLIGENCE', 'PDF') })).toEqual({ state: 'DENIED', document: null });
    expect(renderMaxxisReportDocument({ schema: schema('MAXXIS_ANALYSIS'), exportEntitlement: entitlement('pro', 'MAXXIS_ANALYSIS', 'EMAIL') })).toEqual({ state: 'DENIED', document: null });
  });

  it('keeps blocked preview free of premium data', () => {
    const preview = buildMaxxisReportExportPreview({ schema: schema('DEAL_INTELLIGENCE'), exportEntitlement: entitlement('free', 'DEAL_INTELLIGENCE', 'PDF'), channel: 'PDF' });
    expect(preview).toEqual(expect.objectContaining({ allowed: false, pages: null, includedIntelligence: [], reportPayload: null, confirmAction: null }));
    expect(JSON.stringify(preview)).not.toMatch(/100 Stored St|subject.jpg|Evidence overview/);
  });

  it('creates email request only for the owner and never sends it', () => {
    const access = entitlement('pro', 'MAXXIS_ANALYSIS', 'EMAIL');
    expect(createReportEmailRequest({ recipient: 'investor@example.com', subject: 'Report', reportType: 'MAXXIS_ANALYSIS', propertyId: 'property-1', ownerId: 'user-1', requesterId: 'user-1', exportEntitlement: access }))
      .toMatchObject({ type: 'report_email_request', status: 'PREPARED_NOT_SENT', attachment: null, deliveryId: null });
    expect(createReportEmailRequest({ recipient: 'investor@example.com', subject: 'Report', reportType: 'MAXXIS_ANALYSIS', propertyId: 'property-1', ownerId: 'user-1', requesterId: 'other-user', exportEntitlement: access })).toBeNull();
  });

  it('creates metadata-only own-report share foundation and rejects cross-owner access', () => {
    const access = entitlement('enterprise', 'DEAL_INTELLIGENCE', 'SHARE');
    const input = { id: 'share-1', reportType: 'DEAL_INTELLIGENCE', ownerId: 'user-1', requesterId: 'user-1', createdAt: '2026-09-14', expiresAt: '2026-09-21', accessLevel: 'ENTERPRISE', exportEntitlement: access };
    expect(createSharedReport(input)).toMatchObject({ type: 'shared_report', status: 'PREPARED_NOT_PUBLISHED', url: null, token: null, reportData: null });
    expect(createSharedReport({ ...input, requesterId: 'other-user' })).toBeNull();
  });

  it('renders prepared actions and preview without triggering delivery', () => {
    const onPrepared = vi.fn();
    const reportSchema = schema('MAXXIS_ANALYSIS');
    const decisions = Object.fromEntries(['PDF', 'EMAIL', 'SHARE'].map((channel) => [channel, entitlement('pro', 'MAXXIS_ANALYSIS', channel)]));
    const html = renderToStaticMarkup(<MaxxisReportExportActions schema={reportSchema} exportEntitlements={decisions} language="en" onPrepared={onPrepared} />);
    expect(html).toContain('Export PDF');
    expect(html).toContain('Send Email');
    expect(html).toContain('Share');
    expect(onPrepared).not.toHaveBeenCalled();
  });

  it('has no provider, engine, payment, balance, network or delivery implementation', () => {
    const files = ['./reportExportEntitlement.js', './maxxisReportRenderer.js', './maxxisReportDeliveryContracts.js', './maxxisReportExportPreview.js'];
    const source = files.map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
    expect(source).not.toMatch(/from ['"].*(?:rentcast|stripe|nuggetService|arvEngine|compEngine|dealMetrics)/i);
    expect(source).not.toMatch(/\b(?:fetch|supabase|invoke|sendEmail|publish|debit|charge)\s*\(/i);
  });
});
