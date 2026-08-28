import { describe, expect, it } from 'vitest';
import { TOOLS_POLICY } from './prompts.ts';

describe('Maxxis tool routing policy', () => {
  it('routes profile-fit opportunity requests to personalized property search', () => {
    expect(TOOLS_POLICY).toContain('Always call searchProperties with personalized=true');
    expect(TOOLS_POLICY).toContain('never call getMyInvestmentProfile instead');
  });
});
