import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UnlockModal } from './UnlockModal';

const match = { id: 'contact-1', name: 'Dr. Dree', unlockScope: 'person' };
const linkedOption = {
  property: { id: 'property-1', address: '249 Majestic Gardens Ln' },
  title: '249 Majestic Gardens Ln',
  location: 'Withers Heaven, FL, 33880',
  exclusiveCost: 28,
  mode: 'total',
  status: { kind: 'new', canBuyExclusivity: true },
};

describe('UnlockModal balance states', () => {
  it('keeps the original unlock labels and styles while disabling unaffordable actions', () => {
    const html = renderToStaticMarkup(
      <UnlockModal
        match={match}
        nuggets={2}
        unlockCost={8}
        contactExclusivityOption={linkedOption}
        onUnlock={() => {}}
        onBuyMore={() => {}}
        onClose={() => {}}
      />
    );

    expect(html).toContain('data-testid="unlock-normal-action"');
    expect(html).toContain('Unlock for 8 nuggets');
    expect(html).toContain('data-testid="unlock-linked-exclusive-action"');
    expect(html).toContain('Unlock contact + property exclusivity for 28 nuggets');
    expect(html).toContain('linear-gradient(90deg, #05462d, #14b8a6)');
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });

  it('replaces the removed Cancel footer with a Pricing action only when balance is insufficient', () => {
    const insufficient = renderToStaticMarkup(
      <UnlockModal match={match} nuggets={2} unlockCost={8} onUnlock={() => {}} onBuyMore={() => {}} onClose={() => {}} />
    );
    const sufficient = renderToStaticMarkup(
      <UnlockModal match={match} nuggets={20} unlockCost={8} onUnlock={() => {}} onBuyMore={() => {}} onClose={() => {}} />
    );

    expect(insufficient).toContain('data-testid="unlock-pricing-action"');
    expect(insufficient).toContain('Go to Pricing');
    expect(insufficient).not.toContain('>Cancel<');
    expect(sufficient).not.toContain('data-testid="unlock-pricing-action"');
    expect(sufficient).not.toContain('>Cancel<');
  });
});
