import {describe,it,expect} from 'vitest';
import {resolveOnboardingPreviewProfile} from './onboardingPreviewProfile';
const saved={personalProfile:{fullNameFsbo:'FSBO Owner',photoFsbo:'/fsbo.jpg',emailFsbo:'fsbo@example.test'},professionalProfile:{fullNameA:'Investor',photoA:'/personal.jpg',emailA:'personal@example.test',fullNameB:'Business',photoB:'/business.jpg'}};
describe('onboarding preview profile identity',()=>{
  it.each(['professional','fsbo_owner'])('keeps Personal, FSBO and Business identities separate in %s onboarding',accountType=>{
    const input={...saved,accountType};
    expect(['personal','fsbo','professional'].map(scope=>resolveOnboardingPreviewProfile(scope,input).photo)).toEqual(['/personal.jpg','/fsbo.jpg','/business.jpg']);
    expect(resolveOnboardingPreviewProfile('fsbo',input).email).toBe('fsbo@example.test');
  });
  it.each([['professional','personal','fsbo'],['fsbo_owner','fsbo','personal']])('applies the primary draft only to its own profile in %s', (accountType,active,other)=>{
    const input={...saved,accountType,primaryDraft:{photo:'/edited.jpg',name:'Edited name',primaryPhone:'123'}};
    expect(resolveOnboardingPreviewProfile(active,input)).toMatchObject({photo:'/edited.jpg',name:'Edited name'});
    expect(resolveOnboardingPreviewProfile(other,input).photo).toBe(other==='fsbo'?'/fsbo.jpg':'/personal.jpg');
  });
  it('preserves deliberate clearing and does not use another profile photo as a fallback',()=>{
    expect(resolveOnboardingPreviewProfile('personal',{...saved,accountType:'professional',primaryDraft:{photo:''}}).photo).toBe('');
    expect(resolveOnboardingPreviewProfile('fsbo',{accountType:'professional',professionalProfile:saved.professionalProfile}).photo).toBe('');
  });
});
