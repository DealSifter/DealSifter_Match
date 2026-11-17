/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { MaxxisAssistant } from './MaxxisAssistant';
import { buildReportPreflight, mergeConfirmedCompletion } from '../../../supabase/functions/_shared/maxxis/reportCompletion';
import { saveReportCompletionRequest } from '../../features/maxxis/intelligence/reportCompletionRequest';

const mocks=vi.hoisted(()=>({prepare:vi.fn(),save:vi.fn(),read:vi.fn(),send:vi.fn(),persist:vi.fn()}));
vi.mock('../../services/maxxisAnalysisInputsService',()=>({prepareMaxxisReportCompletion:mocks.prepare,saveConfirmedCompletionInputs:mocks.save,
  readMaxxisAnalysisInputs:mocks.read,saveMaxxisAnalysisInputs:vi.fn(),declineMaxxisAnalysisInputs:vi.fn()}));
vi.mock('../../services/maxxisService',async importOriginal=>({...await importOriginal(),sendMaxxisMessage:mocks.send}));
vi.mock('../../features/maxxis/presentation/reportNarrativePresentation',()=>({prepareReportNarrativePresentation:async()=>null}));
const propertyId='11111111-1111-4111-8111-111111111111';
const property={id:propertyId,type:'SFR',objective:'Buy and Hold',price:200000,title:'Fictional property',address:'Sample property',city:'Example',state:'FL',zip:'00000',beds:3,baths:2,sqft:1500};
const values={rent:2000,vacancyRate:5,opexMethod:'ITEMIZED',propertyTax:2200,HOA:0,managementPercent:0,maintenanceAmount:1200,utilities:0,otherOperatingExpenses:0,monthlyPI:0,cashInvested:200000};
afterEach(()=>{cleanup();localStorage.clear();vi.clearAllMocks();vi.unstubAllGlobals();});
beforeEach(()=>{
  window.matchMedia=vi.fn(()=>({matches:true,addEventListener:()=>{},removeEventListener:()=>{}}));
  Element.prototype.scrollIntoView=vi.fn();
  vi.stubGlobal('ResizeObserver',class { observe(){} disconnect(){} unobserve(){} });
});

describe('Maxxis actual component, mocked transport; not authenticated E2E',()=>{
  it('R3.1: a live report request is not auto-restored; immediate partial acceptance reaches the same report',async()=>{
    const assumptions=mergeConfirmedCompletion({patch:{scenarioStrategy:'FLIP',purchasePrice:200000,exitValue:300000,rehab:30000,acquisitionCosts:5000},propertyId,userId:'fixture-user',revision:1,now:'2026-11-09T12:00:00Z'});
    assumptions.r3Completion.unknown={holdingCosts:{status:'UNKNOWN'},financingCosts:{status:'UNKNOWN'},sellingCosts:{status:'UNKNOWN'}};
    mocks.prepare.mockImplementation(async(_id,type,options)=>{
      const preflight=buildReportPreflight({propertyId,userId:'fixture-user',property,reportType:type,targetCondition:'AS_IS',dealAssumptions:assumptions,revision:1,partialAccepted:options.partialAccepted});
      return {preflight,result:{type:'deal_insight',answer:'Partial fixture',data:{state:'available',propertyId,property,metrics:{},dealIntelligence:{type:'deal_intelligence_context',propertyContext:property,valuationContext:{state:'unavailable'},comparableEvidence:[],opportunities:[],risks:[],limitations:[]},intelligenceSnapshot:{propertyId,propertyFacts:property,dealAssumptions:{...assumptions,activeScenario:preflight.scenario},analysisRevision:1}}}};
    });
    let finishPersistence;
    mocks.persist.mockReturnValue(new Promise(resolve => { finishPersistence = resolve; }));
    const exportPdf=vi.fn(async()=>{});
    render(<MaxxisAssistant sessionKey="fixture-user" currentPlan="enterprise" enabled propertyContextId={propertyId} propertyCandidates={[property]} onPersistReport={mocks.persist} onExportAnalysisPdf={exportPdf}/>);
    await userEvent.click(screen.getByTestId('maxxis-fab'));
    await userEvent.type(screen.getByTestId('maxxis-input'),'Generate full deal intelligence report');
    await userEvent.keyboard('{Enter}');
    const partial=await screen.findByRole('button',{name:'Continue with partial data'});
    await waitFor(()=>expect(partial).toBeEnabled());
    expect(mocks.prepare).toHaveBeenCalledTimes(1);
    await userEvent.click(partial);
    await waitFor(()=>expect(mocks.persist).toHaveBeenCalledTimes(1),{timeout:10000});
    expect(mocks.prepare).toHaveBeenLastCalledWith(propertyId,'DEAL_INTELLIGENCE',expect.objectContaining({partialAccepted:true}));
    expect(mocks.persist.mock.calls[0][0].reportPayload.data.intelligenceSnapshot.dealAssumptions.activeScenario.calculatedOutputs.ROI).toBeNull();
    expect(screen.getByRole('button', { name: 'Export analysis PDF' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Prepare email' })).toBeDisabled();
    await act(async () => finishPersistence('partial-fixture'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Prepare email' })).toBeEnabled());
    // Structured reports remain exportable without a transient handoff callback,
    // including requests restored from JSON after a reload.
    await userEvent.click(await screen.findByRole('button',{name:'Export analysis PDF'}));
    await waitFor(()=>expect(exportPdf).toHaveBeenCalledTimes(1));
    expect(exportPdf.mock.calls[0][0].onExportPdf).toEqual(expect.any(Function));
  },20000);
  it('R3-09/R3-20: resumes only after plan hydration grants access, without consuming the pending request while Free',async()=>{
    saveReportCompletionRequest('fixture-user',{id:'pending-before-hydration',propertyId,reportType:'DEAL_INTELLIGENCE',expectedRevision:1});
    const assumptions=mergeConfirmedCompletion({patch:values,propertyId,userId:'fixture-user',revision:1,now:'2026-11-05T12:00:00Z'});
    const preflight=buildReportPreflight({propertyId,userId:'fixture-user',property,reportType:'DEAL_INTELLIGENCE',targetCondition:'AS_IS',dealAssumptions:assumptions,revision:1});
    mocks.prepare.mockResolvedValue({preflight});
    const ui=render(<MaxxisAssistant sessionKey="fixture-user" currentPlan="free" enabled propertyContextId={propertyId} propertyCandidates={[property]}/>);
    expect(mocks.prepare).not.toHaveBeenCalled();
    ui.rerender(<MaxxisAssistant sessionKey="fixture-user" currentPlan="enterprise" enabled propertyContextId={propertyId} propertyCandidates={[property]}/>);
    await screen.findByLabelText(/Annual insurance/);
    expect(mocks.prepare).toHaveBeenCalledTimes(1);expect(mocks.send).not.toHaveBeenCalled();expect(mocks.persist).not.toHaveBeenCalled();
  });
  it('R3-16/R3-21: Generate → residual insurance → confirmation → same report, no chat/LLM fallback',async()=>{
    let assumptions=mergeConfirmedCompletion({patch:values,propertyId,userId:'fixture-user',revision:1,now:'2026-11-05T12:00:00Z'});
    mocks.prepare.mockImplementation(async(_id,type,options)=>{
      const preflight=buildReportPreflight({propertyId,userId:'fixture-user',property,reportType:type,targetCondition:'AS_IS',dealAssumptions:assumptions,revision:2,partialAccepted:options.partialAccepted});
      return {preflight,result:{type:'deal_insight',answer:'Deterministic fixture analysis',data:{type:'deal_insight_context',state:'available',propertyId,property,
        investmentProfile:{exists:false},match:{calculable:false},metrics:{},dealIntelligence:{type:'deal_intelligence_context',propertyContext:property,valuationContext:{state:'unavailable'},comparableEvidence:[],opportunities:[],risks:[],limitations:[]},
        intelligenceSnapshot:{propertyId,propertyFacts:property,dealAssumptions:{...assumptions,activeScenario:preflight.scenario},analysisRevision:2}}}};
    });
    mocks.save.mockImplementation(async(_id,patch)=>{assumptions=mergeConfirmedCompletion({existing:assumptions,patch,propertyId,userId:'fixture-user',revision:2,now:'2026-11-05T13:00:00Z'});return {revision:2};});
    mocks.persist.mockResolvedValue('fixture-report');
    const mounted=render(<MaxxisAssistant sessionKey="fixture-user" currentPlan="enterprise" enabled propertyContextId={propertyId} propertyCandidates={[property]}
      onPersistReport={mocks.persist} propertyAnalysisRequest={{id:'original-request',prompt:'Generate Deal Intelligence Report',reportType:'DEAL_INTELLIGENCE',propertyId,
        reportProperty:property,propertyAnalysisContext:{mode:'PROPERTY_ANALYSIS_MODE',property_id:propertyId,report_type:'DEAL_INTELLIGENCE'}}}/>);
    await screen.findByLabelText(/Annual insurance/);
    mounted.unmount();
    render(<MaxxisAssistant sessionKey="fixture-user" currentPlan="enterprise" enabled propertyContextId={propertyId} propertyCandidates={[property]} onPersistReport={mocks.persist}/>);
    const insurance=await screen.findByLabelText(/Annual insurance/);
    expect(mocks.send).not.toHaveBeenCalled();expect(mocks.persist).not.toHaveBeenCalled();
    await userEvent.type(insurance,'1600');await userEvent.click(screen.getByRole('button',{name:'Confirm the values above'}));
    await waitFor(()=>expect(mocks.save).toHaveBeenCalledTimes(1));
    await userEvent.click(await screen.findByRole('button',{name:'Generate with explicit limitations'}));
    await waitFor(()=>expect(mocks.persist).toHaveBeenCalledTimes(1),{timeout:10000});
    expect(mocks.persist.mock.calls[0][0].capability).toBe('DEAL_INTELLIGENCE');expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.prepare.mock.calls.every(call=>call[0]===propertyId&&call[1]==='DEAL_INTELLIGENCE')).toBe(true);
  },20000);
  it('R3-11: discards an account-A preflight response after account B signs in',async()=>{
    let resolve;
    mocks.prepare.mockReturnValue(new Promise(done=>{resolve=done;}));
    const request={id:'a-request',prompt:'Generate report',reportType:'DEAL_INTELLIGENCE',propertyAnalysisContext:{mode:'PROPERTY_ANALYSIS_MODE',property_id:propertyId,report_type:'DEAL_INTELLIGENCE'}};
    const ui=render(<MaxxisAssistant sessionKey="account-a" currentPlan="enterprise" propertyContextId={propertyId} propertyCandidates={[property]} propertyAnalysisRequest={request}/>);
    await waitFor(()=>expect(mocks.prepare).toHaveBeenCalledTimes(1));
    ui.rerender(<MaxxisAssistant sessionKey="account-b" currentPlan="enterprise" propertyContextId={propertyId} propertyCandidates={[property]} propertyAnalysisRequest={null}/>);
    await act(async()=>resolve({preflight:{canGenerate:false,revision:1,questions:[{id:'insurance'}],missingUserInputs:['insurance']}}));
    expect(screen.queryByLabelText(/Annual insurance/)).not.toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();expect(mocks.persist).not.toHaveBeenCalled();
  });
});
