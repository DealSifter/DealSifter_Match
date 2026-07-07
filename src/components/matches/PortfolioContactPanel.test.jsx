import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
  it('renderiza botão de unlock quando isUnlocked=false', () => {
    const onUnlockRequest = vi.fn();
    render(
      <PortfolioContactPanel
        canonicalContact={canonicalContact}
        isUnlocked={false}
        variant="desktop"
        onUnlockRequest={onUnlockRequest}
      />
    );

    screen.getByRole('button', { name: /unlock contact|desbloquear contato/i }).click();
    expect(onUnlockRequest).toHaveBeenCalledTimes(1);
  });

  it('não vaza email nem telefone quando isUnlocked=false mesmo com canonicalContact preenchido', () => {
    render(
      <PortfolioContactPanel
        canonicalContact={canonicalContact}
        isUnlocked={false}
        variant="desktop"
      />
    );

    expect(screen.queryByText('owner@example.com')).toBeNull();
    expect(screen.queryByText('+15551234567')).toBeNull();
    expect(screen.queryByText('+15557654321')).toBeNull();
  });

  it('renderiza email quando isUnlocked=true e dado presente', () => {
    render(
      <PortfolioContactPanel
        canonicalContact={canonicalContact}
        isUnlocked
        variant="desktop"
      />
    );

    expect(screen.getByText('owner@example.com')).toBeTruthy();
  });

  it('renderiza não disponível quando isUnlocked=true e canonicalContact=null', () => {
    vi.useFakeTimers();
    render(
      <PortfolioContactPanel
        canonicalContact={null}
        isUnlocked
        variant="desktop"
      />
    );

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText(/contato não disponível|contact unavailable/i)).toBeTruthy();
    vi.useRealTimers();
  });
});
