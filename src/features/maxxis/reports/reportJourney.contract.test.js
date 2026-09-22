import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const portfolio=readFileSync(new URL('../../../components/matches/MatchesPortfolio.jsx',import.meta.url),'utf8');
const assistant=readFileSync(new URL('../../../components/maxxis/MaxxisAssistant.jsx',import.meta.url),'utf8');
const edge=readFileSync(new URL('../../../../supabase/functions/maxxis-chat/index.ts',import.meta.url),'utf8');
const service=readFileSync(new URL('../../../services/maxxisReportService.js',import.meta.url),'utf8');
describe('canonical report journey contract',()=>{
  it('preserves Basic PDF and separate photo controls',()=>{expect(portfolio).toContain('exportPdfLocal');expect(portfolio).toContain('exportPhotosLocal')});
  it('preserves To, Cc, Bcc and stored email preferences',()=>{expect(portfolio).toContain('emailTo');expect(portfolio).toContain('emailCc');expect(portfolio).toContain('emailBcc');expect(portfolio).toContain('ds_export_mail_defaults')});
  it('omits absent and undefined export values',()=>{expect(portfolio).toContain("cleanValue.toLowerCase() === 'undefined'");expect(portfolio).toContain("filter((line) => line !== null")});
  it('uses the shared deterministic A4 renderer for Basic without viewport sizing',()=>{expect(portfolio).toContain('renderMaxxisReportPdf({ schema, exportEntitlement');expect(portfolio).toContain("reportType: INTELLIGENCE_REPORT_TYPES.PROPERTY_RELEASE");expect(portfolio).not.toMatch(/generateReleasePdf[\s\S]{0,500}innerWidth/)});
  it('hands the selected property to PROPERTY_ANALYSIS_MODE',()=>{expect(portfolio).toContain('propertyAnalysisContext');expect(assistant).toContain("propertyAnalysisContext?.mode === 'PROPERTY_ANALYSIS_MODE'")});
  it('prevents property mode from entering provider conversation routing',()=>{expect(assistant).toContain('providerConversationRequested = !analysisContext')});
  it('gives an explicitly selected report precedence over incidental ARV wording in its safety prompt',()=>{expect(assistant).toContain('if (!requestedReportType && isArvVisualCompReviewIntent(cleanMessage, meta.controlledIntent))')});
  it('forces the canonical report context tool for both authorized report levels',()=>{expect(edge).toContain("name: 'getDealInsightContext'");expect(edge).toContain('reportType: propertyAnalysisContext.report_type')});
  it('persists a report and confirms My Reports in chat',()=>{expect(assistant).toContain('persistedReportId');expect(assistant).toContain('Report saved to My Reports.')});
  it('lists only active owned report artifacts',()=>{expect(service).toContain(".eq('user_id', userId).is('deleted_at', null)")});
  it('does not add a RentCast call or Stripe path',()=>{expect(edge).not.toContain('rentcast.com');expect(service).not.toMatch(/stripe/i)});
});
