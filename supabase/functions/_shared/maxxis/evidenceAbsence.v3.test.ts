import { describe, it, expect } from 'vitest';
import { EVIDENCE_ABSENCE_REASONS, evidenceAbsenceReason, evidenceAbsenceCopy } from './evidenceAbsence.ts';
import { marketRentStateAnswer } from './financialEvidenceAnswer.ts';
import { MarketRentService } from '../property-data/marketRentService.ts';
import { InMemorySupplementalEvidenceCache } from '../property-data/supplementalEvidenceCache.ts';
import { resolveRentAvmSubjectAttributes } from '../property-data/rentAvmSubject.ts';
describe('internal acquisition failures', () => {
  it.each(['PROPERTY_EVIDENCE_LEASE_UNAVAILABLE','PROPERTY_EVIDENCE_LEASE_RELEASE_FAILED','RENT_CACHE_READ_FAILED','PROPERTY_EVIDENCE_ACCESS_CHECK_FAILED'])('classifies pre-provider %s distinctly', code => {
    expect(evidenceAbsenceReason(code)).toBe('INTERNAL_ERROR');
  });
  it('preserves provider failures and has copy for every reason in all languages', () => {
    expect(evidenceAbsenceReason('GIS_HTTP_503')).toBe('PROVIDER_ERROR');
    for (const reason of EVIDENCE_ABSENCE_REASONS) for (const lang of ['pt','en','es']) expect(evidenceAbsenceCopy(reason,lang).length).toBeGreaterThan(20);
    expect(evidenceAbsenceCopy('INTERNAL_ERROR')).toContain('No provider data was lost');
  });
  it('preserves an explicit internal outcome through the chat answer projection', () => {
    const answer = marketRentStateAnswer({state:'PROVIDER_ERROR',propertyId:'fixture',providerCalls:0,absenceReason:'INTERNAL_ERROR'}, 'en');
    expect(JSON.stringify(answer)).toContain('No provider data was lost');
  });
  it('classifies a normalized RPC failure before HTTP as internal and never caches a provider outage', async()=>{
    const cache=new InMemorySupplementalEvidenceCache();
    const property={id:'11111111-1111-4111-8111-111111111111',address:'100 Fictional Street',city:'Austin',state:'TX',zip:'78701',type:'SFR',beds:3,baths:2,sqft:1500};
    const service=new MarketRentService({cache,enabled:true,hasEntitlement:async()=>true,resolveSubject:async()=>resolveRentAvmSubjectAttributes({property}),execution:{recorded:true,providerCalls:0,phase:'BEFORE_HTTP'},provider:{getRentEstimate:async()=>{throw Error('PROVIDER_UPSTREAM_ERROR')}} as never});
    const result=await service.get({propertyId:property.id,userId:'fictional',acquire:true});
    expect(result).toMatchObject({providerCalls:0,executionPhase:'BEFORE_HTTP',absenceReason:'INTERNAL_ERROR'});
  });
});
