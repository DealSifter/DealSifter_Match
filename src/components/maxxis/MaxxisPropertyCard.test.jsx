// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageBubble } from './MaxxisCapabilities';

const properties = [
  { id: '22222222-2222-4222-8222-222222222222', title: '249 Majestic Gardens Ln', propertyType: 'SFR', city: 'Winter Haven', state: 'FL' },
  { id: '33333333-3333-4333-8333-333333333333', title: '5939 Droad St', propertyType: 'SFR', city: 'Dallas', state: 'TX' },
];

afterEach(cleanup);

describe('Maxxis property chooser actions', () => {
  it('analyzes in chat from the primary action without navigating', () => {
    const onSelectProperty = vi.fn();
    const onOpenFeedCard = vi.fn();
    render(<MessageBubble
      language="pt"
      message={{ id: 'properties', role: 'assistant', content: 'Escolha.', type: 'properties', data: { properties } }}
      onSelectProperty={onSelectProperty}
      onOpenFeedCard={onOpenFeedCard}
    />);

    fireEvent.click(screen.getAllByRole('button', { name: /Analisar com Maxxis/i })[0]);
    expect(onSelectProperty).toHaveBeenCalledWith(properties[0]);
    expect(onOpenFeedCard).not.toHaveBeenCalled();
  });

  it('navigates only from the separate open-property action and can select another property', () => {
    const onSelectProperty = vi.fn();
    const onOpenFeedCard = vi.fn();
    render(<MessageBubble
      language="pt"
      message={{ id: 'properties', role: 'assistant', content: 'Escolha.', type: 'properties', data: { properties } }}
      onSelectProperty={onSelectProperty}
      onOpenFeedCard={onOpenFeedCard}
    />);

    fireEvent.click(screen.getAllByRole('button', { name: /Abrir imóvel/i })[0]);
    expect(onOpenFeedCard).toHaveBeenCalledWith(properties[0], expect.objectContaining({ source: 'maxxis_property_option_open' }));
    expect(onSelectProperty).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: /Analisar com Maxxis/i })[1]);
    expect(onSelectProperty).toHaveBeenCalledWith(properties[1]);
  });
});
