/** Display boundary: raw domain/provider/model objects are never drawing inputs. */
export type ReportLocale = 'pt' | 'en' | 'es';
export type ReportLevel = 'PROPERTY_RELEASE' | 'MAXXIS_ANALYSIS' | 'DEAL_INTELLIGENCE';
export type ReportValueState = 'VALUE' | 'EXPLICIT_ZERO' | 'PROVISIONAL' | 'CONFLICTED' | 'UNAVAILABLE' | 'NOT_APPLICABLE';
export interface ReportValue {
  state: ReportValueState;
  text: string;
  numericValue: number | null;
  source: string;
  evidenceRefs: string[];
}
export interface ReportRow { label: string; value: string; source?: string; evidenceRefs: string[]; state?: ReportValueState }
export interface ReportClaim { text: string; evidenceRefs: string[] }
export interface ReportMapPoint { id: string; marker: string; latitude: number; longitude: number; markerTone?: string }
export interface ReportTable { columns: string[]; rows: string[][]; evidenceRefs: string[][] }
export interface ReportSection {
  id: string;
  title: string;
  kind: 'narrative' | 'list' | 'facts' | 'comparables' | 'notes' | 'market';
  priority: number;
  text?: string;
  items?: ReportClaim[];
  rows?: ReportRow[];
  table?: ReportTable;
  map?: { points: ReportMapPoint[]; caption: string };
  range?: { low: string; high: string; estimate: string; position: number };
  hero?: { label: string; value: string; qualification: string };
  evidenceRefs: string[];
  continuationPolicy: 'SAME_SECTION';
}
export interface ReportViewModel {
  type: 'strict_report_view_model';
  version: 'REPORT_PROJECTION_V3';
  reportType: ReportLevel;
  locale: ReportLocale;
  header: { product: string; subtitle: string; plan: string; tagline: string };
  property: {
    title: string; address: string; location: string; price: string;
    type: string; strategy: string;
    metrics: ReportRow[];
    facts: { title: string; rows: ReportRow[] }[];
    notes: string[];
    photos: string[];
    locationPoint: ReportMapPoint | null;
  };
  executive: {
    thesis: ReportClaim;
    status: string;
    coverage: ReportRow[];
    opportunity: ReportClaim | null;
    risk: ReportClaim | null;
    blocker: ReportClaim | null;
  } | null;
  sections: ReportSection[];
  values: Record<string, ReportValue>;
  disclaimer: string;
  diagnostics: string[];
  evidencePacket: { id: string; text: string; numericValues: number[]; sourceRefs: string[] }[];
}
