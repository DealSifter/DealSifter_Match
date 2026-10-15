import { describe, expect, it } from 'vitest';
import { mergePropertyReleaseEvidence } from './propertyReleaseEvidence';

describe('Property Release canonical evidence merge', () => {
  it('uses authorized verified facts without adding premium analysis', () => {
    const merged = mergePropertyReleaseEvidence({ id: 'p1', notes: 'Owner note', description: 'Property summary' }, {
      state: 'unlocked', intelligence: { fields: {
        yearBuilt: { value: 1976, status: 'VERIFIED_RECORD' },
        county: { value: 'Jefferson', status: 'VERIFIED_RECORD' },
        lotSizeSqft: { value: 49_658.4, status: 'VERIFIED_RECORD' },
        annualPropertyTax: { value: 5168, status: 'VERIFIED_RECORD' },
        assessedValue: { value: 1_842_500, status: 'VERIFIED_RECORD' },
        latestSalePrice: { value: 682_130, status: 'VERIFIED_RECORD' },
      } },
    });
    expect(merged).toMatchObject({ yearBuilt: 1976, county: 'Jefferson', lotSizeSqft: 49_658.4,
      annualPropertyTax: 5168, assessedValue: 1_842_500, latestSalePrice: 682_130,
      notes: 'Owner note', propertyUserNotes: 'Owner note', maxxisPropertySummary: 'Property summary' });
    expect(merged).not.toHaveProperty('comparableEvidence');
    expect(merged).not.toHaveProperty('valuationEvidence');
  });

  it('does not expose evidence when the backend has not authorized it', () => {
    expect(mergePropertyReleaseEvidence({ id: 'p1' }, { state: 'locked', intelligence: { fields: {
      yearBuilt: { value: 1976, status: 'VERIFIED_RECORD' },
    } } })).toEqual({ id: 'p1' });
  });
  const publicParcel={propertyId:'p1',state:'available',reason:'VERIFIED_PUBLIC_PARCEL',fields:{assessorId:{value:'000-TEST-001',status:'VERIFIED_RECORD',source:'PUBLIC_PARCEL:test-source'}}};
  it('projects available public APN into the shared canonical/report contract without premium access',()=>{
    const merged=mergePropertyReleaseEvidence({id:'p1',type:'SFR',price:90000,lot:5000},{state:'locked'},publicParcel);
    expect(merged.assessorId).toBe('000-TEST-001');expect(merged.canonicalPropertyFacts.parcel.assessorId.source).toBe('PUBLIC_PARCEL:test-source');expect(merged.price).toBe(90000);expect(merged.lot).toBe(5000);expect(merged).not.toHaveProperty('valuationEvidence');
  });
  it('refuses evidence belonging to another property or with an invalid status',()=>{
    expect(mergePropertyReleaseEvidence({id:'other'},null,publicParcel)).not.toHaveProperty('assessorId');
    expect(mergePropertyReleaseEvidence({id:'p1'},null,{...publicParcel,state:'unavailable'})).not.toHaveProperty('assessorId');
  });
  it('does not silently choose between conflicting recorded APNs',()=>{
    const merged=mergePropertyReleaseEvidence({id:'p1'},{state:'unlocked',intelligence:{fields:{assessorId:{value:'OTHER',status:'VERIFIED_RECORD'}}}},publicParcel);
    expect(merged.assessorId).toBeNull();expect(merged.canonicalPropertyFacts.parcel.assessorId.value).toBeNull();expect(merged.parcelReportState).toBe('APN_CONFLICT');
  });
});
