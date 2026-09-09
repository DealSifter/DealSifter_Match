import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MessageBubble } from './MaxxisCapabilities';

describe('Maxxis Deal AI structured result presentation', () => {
  it('renders provider identity as a canonical service navigation control', () => {
    const serviceId = '11111111-1111-4111-8111-111111111111';
    const onOpenProvider = vi.fn();
    const html = renderToStaticMarkup(
      <MessageBubble
        language="en"
        message={{
          id: 'provider-result',
          role: 'assistant',
          content: 'Matching provider found.',
          type: 'services',
          data: {
            services: [{
              id: serviceId,
              title: 'Verified Inspector',
              serviceType: 'Inspection',
              markets: ['TX'],
              price: null,
              contactAccess: { status: 'locked', cost: 3 },
            }],
          },
        }}
        onOpenProvider={onOpenProvider}
      />,
    );

    expect(html).toContain('class="maxxis-inline-link"');
    expect(html).toContain('Verified Inspector');
    expect(html).not.toContain('href=');
    expect(onOpenProvider).not.toHaveBeenCalled();
  });

  it('renders property option titles as controlled feed navigation links', () => {
    const propertyId = '22222222-2222-4222-8222-222222222222';
    const onOpenFeedCard = vi.fn();
    const html = renderToStaticMarkup(
      <MessageBubble
        language="en"
        message={{
          id: 'property-options',
          role: 'assistant',
          content: 'Pick one property.',
          type: 'properties',
          data: {
            properties: [{
              id: propertyId,
              title: '249 Majestic Gardens Ln',
              propertyType: 'SFR',
              city: 'Winters Haven',
              state: 'FL',
              zip: '33880',
              price: 314000,
              bedrooms: 4,
              bathrooms: 2,
              match: { calculable: true, score: 40, classification: 'moderate' },
            }],
          },
        }}
        onOpenFeedCard={onOpenFeedCard}
      />,
    );

    expect(html).toContain('class="maxxis-inline-link"');
    expect(html).toContain('Property A · 249 Majestic Gardens Ln');
    expect(html).not.toContain('href=');
    expect(onOpenFeedCard).not.toHaveBeenCalled();
  });

  it('keeps structured results readable and distinguishes links from actions', () => {
    const css = readFileSync(new URL('./MaxxisAssistant.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.maxxis-action-links\s*\{[\s\S]*?font-family:\s*['"]Inter/);
    expect(css).toMatch(/\.maxxis-action-link\s*\{[\s\S]*?font-weight:\s*400/);
    expect(css).toMatch(/\.maxxis-inline-link\s*\{[\s\S]*?color:\s*var\(--accent-hex\)[\s\S]*?text-decoration:\s*underline/);
    expect(css).toMatch(/\.maxxis-inline-link:focus-visible/);
  });
});
