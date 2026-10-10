import { describe, expect, it } from 'vitest';
import { resolveLocalLandDevelopment, landScenarioForPersistence } from './maxxisLandDevelopment';
const property = { id: 'gable', type: 'Land', price: 19000, lot: '1.14 acres', state: 'AL' };
describe('Property-scoped local land decision coach', () => {
  it('answers the initial development intent and area follow-up with zero provider calls', () => {
    const first = resolveLocalLandDevelopment({ property, message: 'subdividir em dois lotes e construir duas casas', language: 'pt' });
    expect(first.data.scenario.calculatedOutputs.nextInput).toBe('proposedBuildingSqftPerUnit');
    const second = resolveLocalLandDevelopment({ property, messages: [{ role: 'assistant', ...first }], message: '1500 sqft cada', language: 'pt' });
    expect(second.data.scenario.calculatedOutputs.hardCost.central).toBe(436500);
    expect(second.data.providerCalls).toBe(0);
    expect(second.content).toContain('scenario-save');
  });
  it('does not carry development assumptions between properties', () => {
    const first = resolveLocalLandDevelopment({ property, message: 'construir duas casas' });
    expect(resolveLocalLandDevelopment({ property: { ...property, id: 'other' }, messages: [{ ...first, role: 'assistant' }], message: '1500 sqft' })).toBeNull();
  });
  it('does not intercept report generation or improved-property workflows', () => {
    expect(resolveLocalLandDevelopment({ property, message: 'gerar relatório de construção de duas casas' })).toBeNull();
    expect(resolveLocalLandDevelopment({ property: { ...property, type: 'SFR' }, message: 'construir duas casas' })).toBeNull();
  });
  it('keeps explicit rate when user changes the building size', () => {
    const first = resolveLocalLandDevelopment({ property, message: 'construir duas casas de 1500 sqft por $180/sqft' });
    const second = resolveLocalLandDevelopment({ property, messages: [first], message: '2000 sqft cada' });
    expect(second.data.scenario.calculatedOutputs.hardCost.central).toBe(720000);
  });
  it('compares 1500 and 2000 sqft deterministic cost ranges without choosing a winner', () => {
    const first = resolveLocalLandDevelopment({ property, message: 'construir duas casas de 1500 sqft' });
    const second = resolveLocalLandDevelopment({ property, messages: [first], message: 'Compare duas casas de 1500 sqft versus duas casas de 2000 sqft', language: 'pt' });
    expect(second.data.scenario.calculatedOutputs.hardCost.central).toBe(582000);
    expect(second.data.comparison['hardCost.central'].absolute).toBe(145500);
    expect(second.content).toContain('nenhuma alternativa é considerada melhor');
  });
  it('saves summaries and all assumptions without duplicating oversized provider records', () => {
    const reply = resolveLocalLandDevelopment({ property, message: 'construir duas casas de 1500 sqft' });
    const scenario = { ...reply.data.scenario, calculatedOutputs: { ...reply.data.scenario.calculatedOutputs,
      landAcquisitionReference: { valuationComps: Array(200).fill({ evidence: 'x'.repeat(200) }), exclusions: Array(200).fill({ reason: 'x'.repeat(200) }),
        selectedComparables: Array(200).fill({ evidence: 'x'.repeat(200) }), supportingCandidates: Array(200).fill({ evidence: 'x'.repeat(200) }), centralEstimate: 20000 } } };
    const saved = landScenarioForPersistence(scenario);
    expect(JSON.stringify(saved).length).toBeLessThan(16000);
    expect(saved.assumptions).toEqual(scenario.assumptions);
    expect(saved.calculatedOutputs.landAcquisitionReference).toEqual({ centralEstimate: 20000 });
    expect(scenario.calculatedOutputs.landAcquisitionReference.selectedComparables).toHaveLength(200);
  });
});
