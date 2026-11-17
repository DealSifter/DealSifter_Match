import { readMaxxisReportForDelivery } from '../../../services/maxxisReportService';
import { resolveSavedReportAccessDecision } from './savedReportAccess';
import { resolveReportExportEntitlements } from '../export/reportExportEntitlement';

const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
    .filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  return value;
};
export async function reportSnapshotFingerprint(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Contains identifiers and a hash only; the private snapshot stays in maxxis_reports.
export async function createReportDeliveryReference(report, userId, language = 'en') {
  const data = report?.reportPayload?.data;
  const schema = data?.maxxisReport;
  const request = data?.analysisRequest;
  if (!report?.id || !userId || !schema || schema.reportType !== report.capability
    || String(schema.sections?.propertySummary?.data?.id || '') !== String(report.propertyId || '')
    || (request?.propertyId && request.propertyId !== report.propertyId)
    || (request?.reportType && request.reportType !== report.capability)) throw new Error('REPORT_DELIVERY_CONTEXT_MISMATCH');
  return { reportId: report.id, userId, propertyId: report.propertyId, reportType: report.capability,
    reportRequestId: request?.id || null, reportVersion: report.reportVersion || '1',
    scenarioId: schema.presentation?.activeScenario?.id || null,
    scenarioVersion: request?.scenarioVersion ?? schema.presentation?.activeScenario?.version ?? null,
    fingerprint: await reportSnapshotFingerprint({ schema, request: request || null }),
    language: request?.language || schema.resolvedUserLocale || language,
    state: 'PREPARED' };
}

export async function resolveReportDelivery(reference, userId, readReport = readMaxxisReportForDelivery) {
  if (!userId || reference?.userId !== userId) throw new Error('REPORT_DELIVERY_UNAUTHORIZED');
  const report = await readReport(reference.reportId, userId);
  const current = await createReportDeliveryReference(report, userId, reference.language);
  const keys = ['reportId', 'propertyId', 'reportType', 'reportVersion', 'reportRequestId', 'scenarioId', 'scenarioVersion', 'fingerprint', 'language'];
  if (keys.some(key => current[key] !== reference[key])) throw new Error('REPORT_DELIVERY_STALE');
  const grant = resolveSavedReportAccessDecision(report);
  if (!grant) throw new Error('REPORT_DELIVERY_UNAUTHORIZED');
  return { report, schema: report.reportPayload.data.maxxisReport,
    entitlements: resolveReportExportEntitlements({ reportType: report.capability, grantedAccessDecision: grant }) };
}

export function reportEmailDraft({ to = '', cc = '', bcc = '', reportType, reportId, language = 'en' }) {
  const fields = { to, cc, bcc };
  let count = 0;
  for (const [key, value] of Object.entries(fields)) {
    if (/[\r\n]/.test(value) || value.length > 1000) throw new Error('REPORT_DELIVERY_INVALID_RECIPIENT');
    const addresses = value.split(/[;,]/).map(part => part.trim()).filter(Boolean);
    if (addresses.some(address => !/^[^\s@<>?&#]+@[^\s@<>?&#]+\.[^\s@<>?&#]+$/.test(address))) throw new Error('REPORT_DELIVERY_INVALID_RECIPIENT');
    fields[key] = addresses.join(','); count += addresses.length;
  }
  if (!fields.to || count > 10) throw new Error('REPORT_DELIVERY_INVALID_RECIPIENT');
  const level = reportType === 'DEAL_INTELLIGENCE' ? 'L3' : reportType === 'MAXXIS_ANALYSIS' ? 'L2' : 'L1';
  const body = language === 'pt' ? `Relatório ${level} · ${reportId}\r\nAnexe manualmente o PDF baixado no DealSifter antes de enviar.`
    : language === 'es' ? `Informe ${level} · ${reportId}\r\nAdjunte manualmente el PDF descargado en DealSifter antes de enviar.`
      : `Report ${level} · ${reportId}\r\nManually attach the PDF downloaded from DealSifter before sending.`;
  // RFC 6068, not form encoding: Outlook treats '+' literally, and empty copy
  // headers can be interpreted as recipient text. Include populated fields only.
  const headers = { ...(fields.cc ? { cc: fields.cc } : {}), ...(fields.bcc ? { bcc: fields.bcc } : {}),
    subject: `DealSifter · ${level} report`, body };
  return `mailto:${encodeURIComponent(fields.to)}?${Object.entries(headers).map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('&')}`;
}

const key = userId => `ds_report_delivery_v1:${userId}`;
export function savePendingReportDelivery(reference) {
  try { sessionStorage.setItem(key(reference.userId), JSON.stringify(reference)); } catch { /* Optional reload continuity. */ }
}
export function readPendingReportDelivery(userId) {
  try { const value = JSON.parse(sessionStorage.getItem(key(userId)) || 'null'); return value?.userId === userId ? value : null; } catch { return null; }
}
export function clearPendingReportDelivery(userId) {
  try { sessionStorage.removeItem(key(userId)); } catch { /* Storage may be disabled. */ }
}
