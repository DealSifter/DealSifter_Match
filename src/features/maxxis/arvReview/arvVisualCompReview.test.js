import { describe, expect, it } from 'vitest';
import {
  ARV_TARGET_CONDITIONS,
  arvReviewGuidance,
  isArvVisualCompReviewIntent,
  resolveExternalCompReviewLink,
} from './arvVisualCompReview';

describe('Maxxis ARV visual review navigation', () => {
  it('detects ARV intents without intercepting unrelated questions', () => {
    expect(isArvVisualCompReviewIntent('What is the ARV of this property?')).toBe(true);
    expect(isArvVisualCompReviewIntent('Qual o valor após reforma?')).toBe(true);
    expect(isArvVisualCompReviewIntent('How does the dashboard work?')).toBe(false);
  });

  it('uses trusted direct links or address-search fallbacks with encoded addresses', () => {
    const address = '436 Kekauluohi St, Honolulu, HI 96825';
    const zillow = resolveExternalCompReviewLink({ provider: 'ZILLOW', address });
    const redfin = resolveExternalCompReviewLink({ provider: 'REDFIN', address });
    expect(zillow).toMatchObject({ provider: 'ZILLOW', mode: 'ADDRESS_SEARCH', source: 'SYSTEM_GENERATED_NAVIGATION' });
    expect(zillow.url).toContain(encodeURIComponent(address));
    expect(redfin.url).toContain(encodeURIComponent(address));
    expect(resolveExternalCompReviewLink({ provider: 'ZILLOW', address, directUrl: 'https://evil.example/listing' }).mode)
      .toBe('ADDRESS_SEARCH');
    expect(resolveExternalCompReviewLink({ provider: 'REDFIN', address, directUrl: 'https://www.redfin.com/real-listing' }).mode)
      .toBe('DIRECT');
  });

  it('keeps condition taxonomies distinct and guidance valuation-free', () => {
    expect(ARV_TARGET_CONDITIONS).toContain('TURN_KEY');
    expect(ARV_TARGET_CONDITIONS).toContain('HIGH_END');
    expect(ARV_TARGET_CONDITIONS).toContain('NEW_CONSTRUCTION');
    expect(new Set(ARV_TARGET_CONDITIONS).size).toBe(8);
    expect(arvReviewGuidance({ status: 'READY_FOR_ARV_EVALUATION', compatibleCount: 2 }, 'en'))
      .toMatch(/no ARV was calculated/i);
  });
});
