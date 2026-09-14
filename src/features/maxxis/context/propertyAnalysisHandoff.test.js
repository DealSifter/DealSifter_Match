import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildPropertyAnalysisHandoff,
  composePropertyAnalysisAcknowledgement,
} from './propertyAnalysisHandoff';

const property = {
  id: '07343e87-1ef8-4ca5-a88e-be49d95431a7',
  address: '5714 Bent Creek Dr',
  city: 'Pinson',
  state: 'AL',
  zip: '35126',
  type: 'Land',
  price: 15000,
};

describe('Property analysis handoff', () => {
  it('creates an allowlisted, explicit property analysis context', () => {
    const result = buildPropertyAnalysisHandoff({
      property,
      reportType: 'MAXXIS_ANALYSIS',
      accessDecision: { allowed: true, state: 'INCLUDED', accessSource: 'SUBSCRIPTION' },
      userPlan: 'pro',
    });
    expect(result).toMatchObject({
      mode: 'PROPERTY_ANALYSIS_MODE',
      property_id: property.id,
      address: property.address,
      report_type: 'MAXXIS_ANALYSIS',
      user_plan: 'PRO',
      entitlement: { allowed: true, state: 'INCLUDED' },
      available_intelligence_context: { selected_property: true, maxxis_analysis: true },
    });
    expect(result.available_property_data.fields).toContain('address');
    expect(result.available_property_data.missing_fields).toContain('beds');
  });

  it('acknowledges property, report and available fields without inventing values', () => {
    const context = buildPropertyAnalysisHandoff({
      property,
      reportType: 'DEAL_INTELLIGENCE',
      accessDecision: { allowed: true },
      userPlan: 'enterprise',
    });
    const message = composePropertyAnalysisAcknowledgement(context, 'pt');
    expect(message).toContain(property.address);
    expect(message).toContain('Deal Intelligence');
    expect(message).toContain('address');
  });

  it('requires valid property and report identifiers', () => {
    expect(buildPropertyAnalysisHandoff({ property: {}, reportType: 'MAXXIS_ANALYSIS' })).toBeNull();
    expect(buildPropertyAnalysisHandoff({ property, reportType: 'UNKNOWN' })).toBeNull();
  });

  it('passes context separately from the prompt and keeps server entitlement authoritative', () => {
    const service = readFileSync(new URL('../../../services/maxxisService.js', import.meta.url), 'utf8');
    const backend = readFileSync(new URL('../../../../supabase/functions/maxxis-chat/index.ts', import.meta.url), 'utf8');
    expect(service).toContain('propertyAnalysis: cleanPropertyAnalysisContext');
    expect(service).toContain("analysisMode: 'PROPERTY_ANALYSIS_MODE'");
    expect(backend).toContain('propertyId !== selectedPropertyId');
    expect(backend).toContain('server-side entitlement decision is authoritative');
    expect(backend).toContain('Do not search for another property');
  });
});
