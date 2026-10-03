import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Onboarding portfolio record visibility', () => {
  it('renders every property linked to the active profile inside the scrollable records list', () => {
    const source = readFileSync(new URL('./Onboarding.jsx', import.meta.url), 'utf8');

    expect(source).toContain('myPortfolio.map((p, i) => (');
    expect(source).not.toContain('myPortfolio.slice(0, 5)');
  });
});
