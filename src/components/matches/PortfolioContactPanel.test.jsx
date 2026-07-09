import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PortfolioContactPanel } from './PortfolioContactPanel';

const canonicalContact = {
  owner_id: 'owner-1',
  contact: {
    name: 'Unlocked Owner',
    avatar_url: 'https://example.com/avatar.jpg',
    category: 'FSBO',
    location: 'FL',
    email: 'owner@example.com',
    phone_primary: '+15551234567',
    phone_secondary: '+15557654321',
    whatsapp: '+15550001111',
    contact_methods: ['phone', 'email', 'chat'],
  },
};

describe('PortfolioContactPanel', () => {
  it('renders an unlock button when isUnlocked=false', () => {
    const html = renderToStaticMarkup(
      <PortfolioContactPanel
        canonicalContact={canonicalContact}
        isUnlocked={false}
        variant="desktop"
        onUnlockRequest={() => {}}
      />
    );

    expect(html).toMatch(/Unlock Contact|Desbloquear contato/i);
  });

  it('does not leak email or phone when isUnlocked=false even with canonicalContact data', () => {
    const html = renderToStaticMarkup(
      <PortfolioContactPanel
        canonicalContact={canonicalContact}
        isUnlocked={false}
        variant="desktop"
      />
    );

    expect(html).not.toContain('owner@example.com');
    expect(html).not.toContain('+15551234567');
    expect(html).not.toContain('+15557654321');
  });

  it('renders email when isUnlocked=true and data is present', () => {
    const html = renderToStaticMarkup(
      <PortfolioContactPanel
        canonicalContact={canonicalContact}
        isUnlocked
        variant="desktop"
      />
    );

    expect(html).toContain('owner@example.com');
  });

  it('renders unavailable state when isUnlocked=true and canonicalContact=null', () => {
    const html = renderToStaticMarkup(
      <PortfolioContactPanel
        canonicalContact={null}
        isUnlocked
        variant="desktop"
      />
    );

    expect(html).toMatch(/Loading contact|Carregando contato/i);
    expect(html).not.toContain('owner@example.com');
  });
});
