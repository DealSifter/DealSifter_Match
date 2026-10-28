import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildMaxxisReportSchema, mergeMaxxisReportProperty } from '../../../domain/maxxis/maxxisReportSchema';
import { buildStrictReportViewModel, formatReportDate } from './reportIntegrityViewModel';
import { projectProviderListingReferences } from '../../../../supabase/functions/_shared/maxxis/reportMarketReferences';
import { resolveRentAvmSubjectAttributes } from '../../../../supabase/functions/_shared/property-data/rentAvmSubject';
import { getCanonicalPropertyEvidenceWithDependencies } from '../../../../supabase/functions/_shared/maxxis/canonicalEvidenceTool';
const property={id:'control',address:'10865 Wystone Ave',city:'Porter Ranch',state:'CA',zip:'91326',type:'SFR',price:1295000,objective:'Sell',notes:'Exact property note.',description:'Exact property description.',owner:{name:'Publisher',notes:'Unrelated publisher biography.'}};
const vm=(dealIntelligence={})=>buildStrictReportViewModel({schema:buildMaxxisReportSchema({reportType:'DEAL_INTELLIGENCE',property,dealIntelligence}),language:'pt'});
describe('surgical report recovery',()=>{
 it('does not use publisher profile description as property notes at the preparation boundary',()=>{
  const source=readFileSync('src/components/matches/MatchesPortfolio.jsx','utf8');
  expect(source).not.toContain('notes: ownerDesc ||');
  expect(source).toContain('notes: item?.propertyUserNotes || item?.notes || item?.description || null');
  expect(JSON.stringify(vm())).not.toContain('Unrelated publisher biography');
  expect(JSON.stringify(vm())).toContain('Exact property note');
 });
 it('rejects a previous property context and preserves ordered actual gallery media',()=>{
  expect(()=>mergeMaxxisReportProperty({id:'other'},property)).toThrow('REPORT_PROPERTY_IDENTITY_MISMATCH');
  const images=['1.jpg','2.jpg','3.jpg','4.jpg','5.jpg'];
  expect(mergeMaxxisReportProperty({...property,images:['1.jpg']},{...property,images}).images).toEqual(images);
 });
 it('merges city aliases only with corroborating street, postal, coordinates and physical identity',()=>{
  const row={addressLine1:'11515 Doral Ave',state:'CA',zipCode:'91326',latitude:34.280538,longitude:-118.549442,livingAreaSqft:2494,bedrooms:5,bathrooms:3,price:1399000,priceSemantic:'PROVIDER_LISTING_PRICE'};
  const a={...row,formattedAddress:'11515 Doral Ave, Los Angeles, CA 91326',providerPropertyId:'la'};
  const b={...row,formattedAddress:'11515 Doral Ave, Porter Ranch, CA 91326',providerPropertyId:'pr'};
  expect(projectProviderListingReferences([a,b])).toHaveLength(1);
  expect(projectProviderListingReferences([a,{...b,addressLine1:'11515 Doral Ave #2',formattedAddress:'11515 Doral Ave #2, Porter Ranch, CA 91326'}])).toHaveLength(2);
  expect(projectProviderListingReferences([a,{...b,zipCode:'91325'}])).toHaveLength(2);
 });
 it('suppresses legacy score-only output without the authenticated profile basis',()=>{
  const model=vm({investmentFit:{score:29,criteria:[{key:'market',score:0},{key:'property_type',score:100}]}});
  expect(model.sections.find(s=>s.id==='profile-fit')).toBeUndefined();
  expect(model.sections.find(s=>s.id==='profile-criteria')).toBeUndefined();
 });
 it('shows a valid partial current profile without changing its engine score',()=>{
  const model=vm({investmentFit:{score:29,profileSource:'AUTHENTICATED_CURRENT_PROFILE',sourceProfile:{targetMarkets:['Los Angeles, CA'],propertyTypes:['SFR']},criteria:[]}});
  expect(model.sections.find(s=>s.id==='profile-fit').gauge.value).toBe(29);
  expect(model.sections.find(s=>s.id==='investor-profile')).toBeDefined();
 });
 it('formats source dates without changing the timestamp',()=>{
  const raw='2026-07-10T00:00:00.000Z';expect(formatReportDate(raw,'pt')).toBe('10/07/2026');expect(raw).toContain('T00:00');
 });
 it('does not block residential rent on a lot-only dispute',()=>{
  expect(resolveRentAvmSubjectAttributes({property:{...property,beds:4,baths:2,sqft:1680},projections:{lotArea:{analyticalUsability:'CONFLICTED'}}}).state).toBe('READY');
 });
 it('does not mislabel a living-area conflict as a parcel conflict',()=>{
  const model=buildStrictReportViewModel({schema:buildMaxxisReportSchema({reportType:'DEAL_INTELLIGENCE',property:{...property,lotSizeSqft:8428,canonicalPropertyFacts:{physical:{lotSizeSqft:{value:8428,status:'VERIFIED_RECORD'},livingAreaSqft:{value:2501,status:'VERIFIED_RECORD',conflict:{field:'livingAreaSqft'}}},conflicts:[{field:'livingAreaSqft',resolution:'UNRESOLVED'}]}},dealIntelligence:{}}),language:'pt'});
  expect(model.values.lotSizeSqft.state).toBe('VALUE');
  expect(model.sections.find(s=>s.id==='next-actions').items.some(item=>item.text.includes('área do lote'))).toBe(false);
 });
 it('preserves cache failures as execution failures, not invalid physical inputs',async()=>{
  const id='588e34cf-bd85-4bb1-88f1-64a1cfa985ea',row={...property,id};
  const result=await getCanonicalPropertyEvidenceWithDependencies({input:{propertyId:id},propertyId:id,userId:'fixture',secret:'fixture',parcelEnabled:false,financialEvidence:true,
   loadPublicProperty:async()=>row,loadCachedProvider:async()=>({type:'property_evidence',propertyId:id,state:'available',entitlementState:'authorized',cacheState:'hit',evidence:{fields:{},internalFields:{},conflicts:[]}}),
   loadRentAvmState:async()=>({property:row,snapshot:null}),loadMarketRent:async()=>{throw Error('RENT_CACHE_FAILURE');}});
  expect(result.marketRent).toMatchObject({state:'PROVIDER_ERROR',reason:'RENT_CACHE_READ_FAILED'});
 });
 it('explains individual SOLD eligibility without excluding a low price automatically',()=>{
  const comp={compIdentifier:'preston',address:'11836 Preston Trails Ave',salePrice:430000,saleDate:'2026-03-24T00:00:00Z',distanceMiles:1.44,similarity:85.86,dataCompletenessScore:70,propertyType:'Single Family',beds:4,baths:3,sqft:2552,role:'SUPPORTING',transactionQuality:'UNKNOWN',promotionBlockers:['SECONDARY_PROXIMITY_WITHOUT_MICRO_MARKET_EVIDENCE'],exclusionReason:'CONDITION_REVIEW_PENDING'};
  const model=vm({valuationIntelligence:{status:'ARV_UNAVAILABLE'},comparableEvidence:{used:[],supporting:[comp],excluded:[]}});
  const diagnostic=model.sections.find(s=>s.id==='sold-diagnostic-1');
  expect(diagnostic.text).toContain('micromercado');expect(diagnostic.text).toContain('70%');expect(diagnostic.text).toContain('não comprova transação atípica');
  expect(model.sections.find(s=>s.id==='value-readiness').rows[0].value).toContain('0 elegíveis');
 });
});
