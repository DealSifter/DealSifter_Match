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

  it('keeps structured results readable and distinguishes links from actions', () => {
    const css = readFileSync(new URL('./MaxxisAssistant.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.maxxis-action-links\s*\{[\s\S]*?font-family:\s*['"]Inter/);
    expect(css).toMatch(/\.maxxis-action-link\s*\{[\s\S]*?font-weight:\s*400/);
    expect(css).toMatch(/\.maxxis-inline-link\s*\{[\s\S]*?color:\s*var\(--accent-hex\)[\s\S]*?text-decoration:\s*underline/);
    expect(css).toMatch(/\.maxxis-inline-link:focus-visible/);
  });
});
