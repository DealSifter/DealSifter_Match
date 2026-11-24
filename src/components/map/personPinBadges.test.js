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

    expect(badges).toEqual(expect.arrayContaining(['For sale by owner', 'TX', 'Property owner', '24 deals', 'Verified', 'Hot', 'SFR', 'Sell']));
    expect(badges.join(' ')).not.toMatch(/hidden@|555-0100|whatsapp|email|phone/i);
  });
  it('expands and deduplicates skills while keeping locality outside the badges', () => {
    const badges = getPersonMapBadges({ type: 'svc_photo', cat: 'Photography', loc: 'FL', linkedServices: [{ category: 'svc_photo' }] }, { language: 'pt-BR', separateLocation: true });
    expect(badges).toEqual(['Fotografia imobiliária']);
  });
});
