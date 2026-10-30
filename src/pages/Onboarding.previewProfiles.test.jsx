// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {Onboarding} from './Onboarding';
import {setLang} from '../i18n/translations';
vi.mock('../components/cards/FeedPreviewModal',()=>({FeedPreviewModal:({profileCards,groups})=><div data-testid="preview-input">{JSON.stringify({profileCards,groups})}</div>}));
vi.mock('../domain/profile/onboardingProfileValidation',async importOriginal=>({...await importOriginal(),evaluateMinimumProfileCompletion:()=>({valid:true})}));
afterEach(cleanup);
describe('onboarding feeds the preview separate identities',()=>{
  it.each(['professional','fsbo_owner'])('preserves each photo, name and linked portfolio in %s mode',async accountType=>{
    localStorage.clear();setLang('en');window.matchMedia=vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
    localStorage.setItem('tempUploads_professional',JSON.stringify({profileThumb:'/another-user.jpg',profileThumbB:'/another-business.jpg'}));
    localStorage.setItem('tempUploads_fsbo',JSON.stringify({profileThumb:'/another-seller.jpg'}));
    const owner='11111111-1111-4111-8111-111111111111';
    const record=(scope,id)=>({id,ownerId:owner,primaryProfile:scope,source:'portfolio',includeInPreview:true,address:id,images:[]});
    const{container}=render(<Onboarding accountType={accountType} setAccountType={()=>{}} setPage={()=>{}} authSession={{userId:owner}}
      personalProfile={{fullNameFsbo:'Seller',photoFsbo:'/seller.jpg',primaryPhoneFsbo:'123'}} professionalProfile={{fullNameA:'Investor',photoA:'/investor.jpg',fullNameB:'Business',photoB:'/business.jpg'}}
      setPersonalProfile={()=>{}} setProfessionalProfile={()=>{}} setUserProfile={()=>{}} propertyPortfolio={[record('personal','personal-property'),record('fsbo','fsbo-property')]} servicePortfolio={[]} setPropertyPortfolio={()=>{}} setServicePortfolio={()=>{}}/>);
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,80));});
    fireEvent.click(container.querySelector('button.onb-preview-feed'));
    const data=JSON.parse(screen.getByTestId('preview-input').textContent);
    expect(data.profileCards.personal).toMatchObject({name:'Investor',photo:'/investor.jpg'});
    expect(data.profileCards.fsbo).toMatchObject({name:'Seller',photo:'/seller.jpg'});
    expect(data.groups.map(group=>[group.profileScope,group.properties.map(property=>property.id)])).toEqual([['personal',['personal-property']],['fsbo',['fsbo-property']]]);
  });
});
