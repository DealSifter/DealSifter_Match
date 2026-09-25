import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MyMaxxisReports } from './MyMaxxisReports';

describe('My Maxxis Reports', () => {
  it('labels a saved report by its real redacted location without inventing a street', () => {
    const html = renderToStaticMarkup(<MyMaxxisReports reports={[{
      id: 'report-1', capability: 'DEAL_INTELLIGENCE', accessSource: 'SUBSCRIPTION_INCLUDED',
      createdAt: '2026-09-21T00:00:00Z', reportPayload: { data: { maxxisReport: {
        sections: { propertySummary: { data: { id: 'property-1', type: 'SFR', city: 'Porter Ranch', state: 'CA', zip: '91326' } } },
      } } },
    }]} />);
    expect(html).toContain('Porter Ranch, CA 91326');
    expect(html).not.toContain('100 Stored St');
  });

  it('localizes saved report labels and access metadata', () => {
    const html = renderToStaticMarkup(<MyMaxxisReports language="pt" reports={[{
      id: 'report-2', capability: 'DEAL_INTELLIGENCE', accessSource: 'SUBSCRIPTION_INCLUDED',
      createdAt: '2026-09-21T00:00:00Z', reportPayload: { data: { maxxisReport: {
        sections: { propertySummary: { data: { city: 'Honolulu', state: 'HI', zip: '96825' } } },
      } } },
    }]} />);
    expect(html).toContain('Inteligência do Negócio');
    expect(html).toContain('Incluído na assinatura');
    expect(html).not.toContain('DEAL INTELLIGENCE');
    expect(html).not.toContain('SUBSCRIPTION_INCLUDED');
  });

  it('keeps saved reports readable with the current dark-theme tokens', () => {
    const css = readFileSync(new URL('./MyMaxxisReports.css', import.meta.url), 'utf8');
    expect(css).toContain('[data-theme="dark"] .my-maxxis-reports');
    expect(css).toContain('var(--card-bg,var(--card,#fff))');
    expect(css).toContain('color:var(--t1,#0f172a)');
  });
});
