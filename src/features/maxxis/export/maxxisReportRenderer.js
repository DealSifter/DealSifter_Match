import { isMatchingReportExportEntitlement } from './reportExportEntitlement';

export const MAXXIS_REPORT_DOCUMENT_VERSION = 'MAXXIS_REPORT_DOCUMENT_V1';
export const MAXXIS_REPORT_DISCLAIMER = 'This report provides evidence-based investment analysis only and does not constitute appraisal, financial advice, or recommendation to buy or sell.';

const section = (schema, key) => schema?.sections?.[key]?.available ? schema.sections[key].data : null;

export function renderMaxxisReportDocument({ schema, exportEntitlement, generatedAt = new Date().toISOString(), language = 'en' } = {}) {
  if (!schema || schema.type !== 'maxxis_report_schema'
    || !isMatchingReportExportEntitlement(exportEntitlement, schema.reportType, 'PDF')) {
    return Object.freeze({ state: 'DENIED', document: null });
  }
  const property = section(schema, 'propertySummary') || {};
  const generatedDate = new Date(generatedAt);
  if (Number.isNaN(generatedDate.getTime())) return Object.freeze({ state: 'DENIED', document: null });
  const pages = schema.pages.map((page) => Object.freeze({
    page: page.page,
    code: page.code,
    header: Object.freeze({ brand: 'DealSifter Match', descriptor: 'Evidence-based investment intelligence', product: 'MAXXIS AI' }),
    sectionKeys: Object.freeze(page.sections.filter((key) => schema.sections[key]?.available)),
    footer: Object.freeze({ page: page.page, generatedAt: generatedDate.toISOString(), version: schema.version, disclaimer: MAXXIS_REPORT_DISCLAIMER }),
  }));
  return Object.freeze({ state: 'PREPARED', document: Object.freeze({
    type: 'maxxis_investment_intelligence_document', version: MAXXIS_REPORT_DOCUMENT_VERSION,
    reportType: schema.reportType, language: ['en', 'pt', 'es'].includes(language) ? language : 'en',
    cover: Object.freeze({
      propertyAddress: property.address || null,
      propertyType: property.type || null,
      strategy: property.objective || null,
      reportType: schema.reportType,
      generatedAt: generatedDate.toISOString(),
      heroImage: Array.isArray(property.images) && property.images[0] ? property.images[0] : null,
    }),
    pages: Object.freeze(pages), pageCount: pages.length, binary: null, downloadUrl: null,
  }) });
}
