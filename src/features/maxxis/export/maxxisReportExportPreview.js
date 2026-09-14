import { isMatchingReportExportEntitlement } from './reportExportEntitlement';

const INCLUDED = Object.freeze({
  PROPERTY_RELEASE: Object.freeze(['Property information', 'Portfolio photos', 'Location map', 'Notes']),
  MAXXIS_ANALYSIS: Object.freeze(['Property Release', 'Executive Summary', 'Investor Fit', 'Risk Analysis', 'Limitations', 'Next Steps']),
  DEAL_INTELLIGENCE: Object.freeze(['Executive Summary', 'Confidence Analysis', 'Comparable Analysis', 'ARV Intelligence', 'KPI Scenarios', 'Risk Analysis', 'Evidence Summary', 'Investor Persona']),
});

export function buildMaxxisReportExportPreview({ schema, exportEntitlement, channel = 'PDF' } = {}) {
  const reportType = String(schema?.reportType || exportEntitlement?.reportType || '').toUpperCase();
  const normalizedChannel = String(channel || '').toUpperCase();
  const allowed = Boolean(schema?.type === 'maxxis_report_schema'
    && isMatchingReportExportEntitlement(exportEntitlement, reportType, normalizedChannel));
  return Object.freeze({
    type: 'maxxis_report_export_preview', state: allowed ? 'READY_TO_CONFIRM' : 'AVAILABLE_WITH_UPGRADE',
    allowed, channel: normalizedChannel, reportType: reportType || null,
    pages: allowed ? schema.pages.length : null,
    includedIntelligence: allowed ? INCLUDED[reportType] || Object.freeze([]) : Object.freeze([]),
    accessLevel: exportEntitlement?.accessLevel || 'FREE', reportPayload: null,
    confirmAction: allowed ? 'PREPARE_DOCUMENT' : null,
  });
}
