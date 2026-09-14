import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLang } from '../i18n/translations';
import { Pricing } from './Pricing';

function renderPricing(currentPlan = null) {
  return renderToStaticMarkup(
    <Pricing
      setPage={() => {}}
      setModal={() => {}}
      prevPage="landing"
      currentPlan={currentPlan}
    />,
  );
}

describe('Pricing Intelligence Economy presentation', () => {
  beforeEach(() => setLang('en'));

  it('presents value before the paywall for all plans without a fake price or quota', () => {
    const html = renderPricing();
    expect(html).toContain('Maxxis Deal AI included');
    expect(html).toContain('Maxxis Analysis 3 Nuggets');
    expect(html).toContain('Deal Intelligence 5 Nuggets');
    expect(html).toContain('Maxxis Analysis and Deal Intelligence included');
    expect(html).toContain('No Nugget charge');
    expect(html).not.toMatch(/X Nuggets|\d+ of \d+ included analyses/);
  });

  it('marks the authenticated in-app plan without changing subscription prices or checkout', () => {
    const html = renderPricing({ planId: 'pro', planName: 'Professional' });
    expect(html).toContain('CURRENT PLAN');
    expect(html).toContain('$49');
    expect(html).toContain('$129');
  });
});
