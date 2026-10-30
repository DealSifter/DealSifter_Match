import {describe,it,expect} from 'vitest';
import {buildScopedProfilePayload,resolvePayloadProfilePhoto} from './profileScopeResolver';
import {normalizeCard} from './normalizeFeedCard';
const scopes=['personal','professional','fsbo'];
describe('profile photos stay isolated across users and scopes',()=>{
  it.each(['owner-one','owner-two'])('uses only each scoped photo for %s',ownerId=>{
    const profilePayload=buildScopedProfilePayload({accountType:'professional',personalProfile:{fullNameFsbo:'Seller',photoFsbo:`/${ownerId}/fsbo.jpg`,photo:'/wrong-generic-personal.jpg'},professionalProfile:{fullNameA:'Investor',photoA:`/${ownerId}/personal.jpg`,fullNameB:'Business',photoB:`/${ownerId}/professional.jpg`}});
    for(const scope of scopes){
      const card=normalizeCard({id:ownerId,ownerId,primaryProfile:scope,cardKind:'person',portfolioCount:1,profilePayload,photo:'/stale-generic.jpg'});
      expect(card.photo).toBe(`/${ownerId}/${scope}.jpg`);
      const property=normalizeCard({id:'property',ownerId,primaryProfile:scope,cardKind:'property',profilePayload,ownerPreview:{primaryProfile:scopes.find(item=>item!==scope),name:'Wrong profile',photo:'/wrong-profile.jpg'}});
      expect(property.ownerPreview).toMatchObject({photo:`/${ownerId}/${scope}.jpg`,primaryProfile:scope});
    }
  });
  it.each(scopes)('keeps %s without a photo instead of borrowing the generic picture',scope=>{
    const profilePayload={resolved:{[scope]:{scope,name:'Correct name',photo:''}},legacy:{personalProfile:{photo:'/personal.jpg',photoFsbo:'/old-fsbo.jpg'},professionalProfile:{photo:'/business.jpg'}}};
    const card=normalizeCard({id:'owner',ownerId:'owner',primaryProfile:scope,cardKind:'person',portfolioCount:1,profilePayload,photo:'/stale.jpg',avatar:'/stale.jpg'});
    expect(card.photo).toBe('');expect(card.avatar).toBe('');
    expect(resolvePayloadProfilePhoto(scope,{photo:''},{photo:'/wrong.jpg',photoFsbo:'/wrong.jpg',photoB:'/wrong.jpg'})).toBe('');
  });
  it('rejects linked galleries from another user or another profile',()=>{
    const card=normalizeCard({id:'owner',ownerId:'owner',primaryProfile:'personal',cardKind:'person',name:'Investor',portfolioCount:1,photo:'/personal.jpg',linkedServices:[{id:'correct',ownerId:'owner',primaryProfile:'personal'},{id:'other-profile',ownerId:'owner',primaryProfile:'fsbo'},{id:'other-owner',ownerId:'another',primaryProfile:'personal'}]});
    expect(card.linkedServices.map(item=>item.id)).toEqual(['correct']);
  });
});

it('ignores generic photos inherited by older FSBO/Business payloads',()=>{
  expect(resolvePayloadProfilePhoto('fsbo',{photo:'/wrong-personal.jpg',photoFsbo:'/correct-fsbo.jpg'})).toBe('/correct-fsbo.jpg');
  expect(resolvePayloadProfilePhoto('professional',{photo:'/wrong-personal.jpg',photoB:'/correct-business.jpg'})).toBe('/correct-business.jpg');
});
