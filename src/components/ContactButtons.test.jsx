import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContactButtons } from './ContactButtons';

describe('ContactButtons', () => {
  it('renders only explicitly provided contact props', () => {
    const html = renderToStaticMarkup(<ContactButtons email="owner@example.com" phone={null} whatsapp={undefined} />);

    expect(html).toContain('owner@example.com');
    expect(html).not.toContain('Phone');
    expect(html).not.toContain('WhatsApp');
  });

  it('does not infer or fallback to hidden contact data', () => {
    const html = renderToStaticMarkup(<ContactButtons />);

    expect(html).toBe('');
  });

  it('renders chat only when chatEnabled is true', () => {
    const hidden = renderToStaticMarkup(<ContactButtons chatEnabled={false} onChatClick={() => {}} />);
    const visible = renderToStaticMarkup(<ContactButtons chatEnabled onChatClick={() => {}} />);

    expect(hidden).not.toContain('DealSifter Chat');
    expect(visible).toContain('DealSifter Chat');
  });
});
