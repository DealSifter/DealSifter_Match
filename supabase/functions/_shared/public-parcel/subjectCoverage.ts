// Explicit APN-first scope. Polygon proof is required; neighborhood proof is not.
// Evidence: qa/gis-subject-first-release/FL_RESULTS.json and retained NC receipts.
import { FL_DOR_COUNTY_CODES } from './statewideCoverage.ts';
// All 67 entries of this existing, static official crosswalk now have bounded
// exact-APN/polygon receipts. This is configuration, not runtime discovery.
// Additional evidence: qa/gis-florida-completion/{APN_RESULTS,EXACT_SEEDS}.json.
export const SUBJECT_FL_COUNTIES = Object.freeze(Object.keys(FL_DOR_COUNTY_CODES).sort());
export const SUBJECT_NC_COUNTIES = ['37015','37027','37033','37035','37055','37073','37079','37085','37119','37129','37155','37159','37167','37177','37185'] as const;
