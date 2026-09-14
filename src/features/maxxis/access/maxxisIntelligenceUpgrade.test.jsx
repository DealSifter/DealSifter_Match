import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createReportEntitlement, REPORT_ACCESS_SOURCES } from '../../../domain/intelligenceAccess';
import { MaxxisIntelligenceUpgradeModal } from './MaxxisIntelligenceUpgradeModal';
import { buildMaxxisIntelligenceUpgradeExperience, INTELLIGENCE_UNLOCK_TYPES } from './maxxisIntelligenceUpgrade';

describe('Maxxis Intelligence Upgrade Experience v1', () => {
  it('shows Free Property Release and both upgrade paths without premium data', () => {
    const experience = buildMaxxisIntelligenceUpgradeExperience({ plan: 'free', requestedReportType: 'DEAL_INTELLIGENCE' });
    expect(experience).toMatchObject({ accessLevel: 'FREE', showModal: true, directAccess: false, premiumPayload: null, mutation: null });
    expect(experience.included.map((item) => item.reportType)).toEqual(['PROPERTY_RELEASE']);
    expect(experience.options.map((item) => item.reportType)).toEqual(['MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE']);
    expect(experience.options[0].unlockTypes).toEqual(['SUBSCRIPTION', 'ONE_TIME_UNLOCK']);
    expect(INTELLIGENCE_UNLOCK_TYPES.ONE_TIME_UNLOCK).toBe('ONE_TIME_UNLOCK');
    expect(JSON.stringify(experience)).not.toMatch(/propertyIntelligence|valuationIntelligence|decisionIntelligence|recordedSalePrice|arvRange/);
  });

  it('shows Pro only the deeper Deal Intelligence path', () => {
    const experience = buildMaxxisIntelligenceUpgradeExperience({ plan: 'pro', requestedReportType: 'DEAL_INTELLIGENCE' });
    expect(experience.included.map((item) => item.reportType)).toEqual(['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS']);
    expect(experience.options.map((item) => item.reportType)).toEqual(['DEAL_INTELLIGENCE']);
    expect(experience.options[0].actionLabel).toBe('Unlock Advanced Intelligence');
  });

  it('opens Enterprise and active one-time entitlement directly without a sales modal', () => {
    expect(buildMaxxisIntelligenceUpgradeExperience({ plan: 'enterprise', requestedReportType: 'DEAL_INTELLIGENCE' }))
      .toMatchObject({ showModal: false, directAccess: true, options: [] });
    const entitlement = createReportEntitlement({ reportType: 'DEAL_INTELLIGENCE', accessSource: REPORT_ACCESS_SOURCES.NUGGET_UNLOCK, expires: '2030-01-01' });
    expect(buildMaxxisIntelligenceUpgradeExperience({ plan: 'free', entitlements: [entitlement], requestedReportType: 'DEAL_INTELLIGENCE' }))
      .toMatchObject({ showModal: false, directAccess: true });
  });

  it('renders calm benefits and placeholders with no price, charge or premium values', () => {
    const onRequestUnlock = vi.fn();
    const html = renderToStaticMarkup(<MaxxisIntelligenceUpgradeModal plan="free" language="en" onRequestUnlock={onRequestUnlock} />);
    expect(html).toContain('Transform your property data into investor-ready analysis.');
    expect(html).toContain('PROPERTY RELEASE');
    expect(html).toContain('Unlock Maxxis Analysis');
    expect(html).toContain('Unlock Deal Intelligence');
    expect(html).toContain('Comparable Analysis');
    expect(html).toContain('ARV Intelligence');
    expect(html).not.toMatch(/PAY NOW|price="|\$[0-9]|recordedSalePrice/);
    expect(onRequestUnlock).not.toHaveBeenCalled();
  });

  it('contains no provider, payment, balance or engine integration', () => {
    const source = readFileSync(new URL('./maxxisIntelligenceUpgrade.js', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from ['"].*(?:rentcast|stripe|nuggetService|arvEngine|compEngine|dealMetrics)/i);
    expect(source).not.toMatch(/\b(?:fetch|supabase|invoke|debit|charge)\s*\(/i);
  });
});
