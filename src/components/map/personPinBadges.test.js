import { describe, expect, it } from 'vitest';
import { getPersonMapBadges } from './personPinBadges';

describe('getPersonMapBadges', () => {
  it('collects personal profile facts and skips contact channels', () => {
    const badges = getPersonMapBadges({
      name: 'Mustache',
      type: 'FSBO',
      loc: 'TX',
      badge: 'Seller',
      deals: 24,
      verified: true,
      isHot: true,
      email: 'hidden@example.com',
      phone: '(512) 555-0100',
      whatsapp: '+15125550100',
      contactMethods: ['email', 'phone'],
      linkedProperties: [{ type: 'SFR', objective: 'Sell', state: 'TX' }],
    }, { deals: 'deals', verified: 'Verified' });

    expect(badges).toEqual(expect.arrayContaining(['FSBO', 'TX', 'Seller', '24 deals', 'Verified', 'Hot', 'SFR', 'Sell']));
    expect(badges.join(' ')).not.toMatch(/hidden@|555-0100|whatsapp|email|phone/i);
  });
});
