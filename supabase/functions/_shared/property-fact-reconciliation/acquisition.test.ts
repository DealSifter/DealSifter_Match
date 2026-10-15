import {describe,expect,it} from 'vitest';
import {hasStablePropertyIdentity,parcelMatchesPropertyAddress} from './acquisition.ts';
import {propertyIdentity} from './model.ts';
const property={id:'33333333-3333-4333-8333-333333333333',address:'100 QA Street',city:'QA City',state:'NC',zip:'27614'};
describe('saved identity and parcel subject binding',()=>{
 it.each(['id','address','city','state','zip'])('rejects incomplete %s before acquisition',field=>expect(hasStablePropertyIdentity({...property,[field]:'  '})).toBe(false));
 it('requires a postal identity and permits a complete saved one',()=>{expect(hasStablePropertyIdentity(property)).toBe(true);expect(hasStablePropertyIdentity({...property,zip:'27614-0001'})).toBe(true);expect(hasStablePropertyIdentity({...property,zip:'abc'})).toBe(false);});
 it('rejects a neighbour parcel even when geometry contains the saved point',()=>{expect(parcelMatchesPropertyAddress(property,'102 QA Street')).toBe(false);expect(parcelMatchesPropertyAddress(property,'100 QA ST, QA City')).toBe(true);});
 it('keeps geometry-only sources qualified without inventing an address',()=>expect(parcelMatchesPropertyAddress(property,null)).toBe(true));
 it('invalidates cached subject identity when a saved PIN is corrected',()=>{expect(propertyIdentity({...property,lat:35,lng:-78})).not.toEqual(propertyIdentity({...property,lat:35.001,lng:-78}));});
});
