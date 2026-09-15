import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dealLoader=readFileSync(new URL('../../../../supabase/functions/_shared/maxxis/getDealInsightContext.ts',import.meta.url),'utf8');
const evidenceLoader=readFileSync(new URL('../../../../supabase/functions/_shared/maxxis/getPropertyEvidence.ts',import.meta.url),'utf8');
const backendFactory=readFileSync(new URL('../../../../supabase/functions/_shared/property-data/backendFactory.ts',import.meta.url),'utf8');
const portfolio=readFileSync(new URL('../../../components/matches/MatchesPortfolio.jsx',import.meta.url),'utf8');
const assistant=readFileSync(new URL('../../../components/maxxis/MaxxisAssistant.jsx',import.meta.url),'utf8');

describe('Deal Intelligence canonical live evidence pipeline',()=>{
  it('uses canonical cache-first services and does not force disabled mode',()=>{
    expect(dealLoader).toContain('createBackendValuationEvidenceService');
    expect(dealLoader).toContain('createBackendSoldEvidenceService');
    expect(dealLoader).toContain('getValuationEvidence');
    expect(dealLoader).toContain('getSoldEvidence');
    expect(dealLoader).not.toContain("name === 'PROPERTY_DATA_MODE' ? 'disabled'");
  });
  it('allows provider fallback only for the explicit Deal Intelligence loader',()=>{
    expect(evidenceLoader).toContain('allowProviderFallback = false');
    expect(evidenceLoader).toContain('createBackendPropertyEvidenceService');
    expect(dealLoader).toContain('propertyId, true');
  });
  it('preserves usage guard, cache and single-flight layers',()=>{
    expect(backendFactory).toContain('SupabasePropertyDataUsageGuard');
    expect(backendFactory).toContain('SupabasePropertySingleFlight');
    expect(backendFactory).toContain('SupabaseValuationEvidenceCache');
    expect(backendFactory).toContain('SupabaseSoldRecordPoolCache');
  });
  it('keeps To, Cc and Bcc independent and preserves UTF-8 content',()=>{
    expect(portfolio).toContain('const [emailTo, setEmailTo]');
    expect(portfolio).toContain('const [emailCc, setEmailCc]');
    expect(portfolio).toContain('const [emailBcc, setEmailBcc]');
    expect(portfolio).toContain("to: String(emailTo || '').trim()");
    expect(portfolio).toContain("cc: String(emailCc || '').trim()");
    expect(portfolio).toContain("bcc: String(emailBcc || '').trim()");
    expect(portfolio).toMatch(/á|ã|ç/);
  });
  it('removes the empty More settings action',()=>{
    expect(assistant).not.toContain('preferencesCopy.moreSettings');
  });
});
