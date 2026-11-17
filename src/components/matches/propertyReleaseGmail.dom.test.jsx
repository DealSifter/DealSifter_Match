// @vitest-environment jsdom
import React from 'react';
import {fireEvent,render,screen,waitFor,cleanup,act} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {PortfolioDetail} from './MatchesPortfolio';
import {setLang} from '../../i18n/translations';
const mocks=vi.hoisted(()=>({source:vi.fn(),prepare:vi.fn(),save:vi.fn()}));
vi.mock('../../services/propertyReleaseMailService',()=>({readPropertyReleaseMailSource:mocks.source,createPropertyReleaseDelivery:mocks.prepare}));
vi.mock('../../services/reportRecipientPreferences',()=>({loadReportRecipientPreferences:async()=>({userId:'actor',senderEmail:'fixture@gmail.com',recipients:{to:'board@example.invalid',cc:'',bcc:''}}),saveReportRecipientPreferences:mocks.save}));
vi.mock('../../features/maxxis/reports/ReportDeliveryModal',()=>({ReportDeliveryModal:({reference,userId})=><div role="dialog" aria-label="Gmail delivery">{reference.propertyId} · {userId}</div>}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
const property={id:'property-a',address:'1200 Synthetic Avenue',city:'Example',state:'FL',price:95000,type:'LAND',objective:'SELL',images:[],isActive:true};
async function open(){act(()=>setLang('en'));const v=render(<PortfolioDetail item={property} owner={{id:'publisher',name:'Synthetic Publisher'}} isOwnerUnlocked viewerUserId="actor" onBack={()=>{}}/>);fireEvent.click(v.container.querySelector('[data-guide="matches-export"]'));fireEvent.click(screen.getByText('Send with Gmail (PDF attached)'));return v;}
describe('Portfolio Property Release Gmail handoff',()=>{
 it('routes email selection to the authenticated Gmail review instead of Outlook or manual attachment controls',async()=>{
 mocks.source.mockResolvedValue({row:property,images:[],fingerprint:'source'});mocks.prepare.mockResolvedValue({reference:{userId:'actor',propertyId:'property-a',reportType:'PROPERTY_RELEASE'}});mocks.save.mockResolvedValue({});
 await open();const button=screen.getByRole('button',{name:'Review Gmail delivery'});await waitFor(()=>expect(button.disabled).toBe(false));fireEvent.click(button);fireEvent.click(button);
 expect((await screen.findByRole('dialog',{name:'Gmail delivery'})).textContent).toContain('property-a · actor');expect(mocks.source).toHaveBeenCalledExactlyOnceWith('actor','property-a');expect(mocks.prepare).toHaveBeenCalledTimes(1);expect(screen.queryByText(/manual attachment|anexar manualmente/)).toBeNull();
 });
 it('keeps the selector open and prevents the handoff when source access is denied',async()=>{
 mocks.source.mockRejectedValue(new Error('REPORT_DELIVERY_UNAUTHORIZED'));mocks.save.mockResolvedValue({});await open();const button=screen.getByRole('button',{name:'Review Gmail delivery'});await waitFor(()=>expect(button.disabled).toBe(false));fireEvent.click(button);await screen.findByRole('alert');expect(mocks.prepare).not.toHaveBeenCalled();expect(screen.queryByRole('dialog',{name:'Gmail delivery'})).toBeNull();
 });
});
