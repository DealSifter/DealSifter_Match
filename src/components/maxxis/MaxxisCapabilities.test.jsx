import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MessageBubble } from './MaxxisCapabilities';
import { MaxxisDealIntelligenceExperience } from '../../features/maxxis/intelligence/MaxxisDealIntelligenceExperience';
import { buildMaxxisIntelligenceUpgradeExperience } from '../../features/maxxis/access/maxxisIntelligenceUpgrade';

describe('Maxxis Deal AI structured result presentation', () => {
  it('uses a three-dot animated processing indicator without static thinking text', () => {
    const assistant = readFileSync(new URL('./MaxxisAssistant.jsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('./MaxxisAssistant.css', import.meta.url), 'utf8');
    expect(assistant).toContain('<i>.</i>');
    expect(assistant.match(/<i>\.<\/i>/g)).toHaveLength(3);
    expect(assistant).not.toContain('<strong>{t.typing}</strong>');
    expect(css).toMatch(/\.maxxis-typing-dots i\s*\{[\s\S]*animation:\s*maxxisTyping/);
    expect(css).toMatch(/@keyframes maxxisTyping/);
  });

  it('keeps a report CTA visible when the answer uses the composed experience', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        language="en"
        message={{ id: 'chat-report-cta', role: 'assistant', type: 'deal_insight',
          content: 'Available property facts.\n\n[[action:deal-intelligence|Generate Deal Intelligence Report — Included]]' }}
        composedExperience={{ status: 'COMPOSED', mode: 'ANALYSIS', headline: 'Property analysis',
          summary: 'Available property facts.', evidence: [], statusItems: [], primaryAction: null,
          secondaryActions: [], followUps: [], tone: 'CALM', presentationHints: { render: true, density: 'COMPACT' } }}
      />,
    );
    expect(html).toContain('Generate Deal Intelligence Report — Included');
    expect(html).toContain('Maxxis Deal AI navigation actions');
  });
  it('renders a non-transactional intelligence upgrade gate without granting access', () => {
    const onRequestIntelligenceUnlock = vi.fn();
    const html = renderToStaticMarkup(
      <MessageBubble
        language="en"
        message={{
          id: 'report-gate', role: 'assistant', type: 'intelligence_access_gate',
          content: 'Unlock deeper intelligence.',
          data: {
            accessDecision: { reportType: 'DEAL_INTELLIGENCE', paidUnlockEnabled: false, nuggetCost: null },
            upgradeExperience: buildMaxxisIntelligenceUpgradeExperience({ plan: 'free', requestedReportType: 'DEAL_INTELLIGENCE' }),
          },
        }}
        onRequestIntelligenceUnlock={onRequestIntelligenceUnlock}
      />,
    );
    expect(html).toContain('MAXXIS INTELLIGENCE');
    expect(html).toContain('Unlock deeper investment intelligence when you need it.');
    expect(html).toContain('Charged once for this property.');
    expect(html).not.toMatch(/recordedSalePrice|valuationIntelligence|propertyIntelligence/);
    expect(onRequestIntelligenceUnlock).not.toHaveBeenCalled();
  });

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

  it('adapts chat controls to dark mode while preserving the report paper', () => {
    const css = readFileSync(new URL('./MaxxisAssistant.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.maxxis-panel\s*\{[\s\S]*?--surface:\s*var\(--card\)/);
    expect(css).toMatch(/\[data-theme="dark"\] \.maxxis-report-v2 > summary\s*\{/);
    expect(css).toMatch(/\.maxxis-v2-page\s*\{[\s\S]*?background:\s*#f7f9fb/);
    expect(css).not.toMatch(/\[data-theme="dark"\] \.maxxis-v2-page\s*\{/);
    expect(css).toMatch(/\.maxxis-v2-section-title\s*\{[\s\S]*?box-shadow:\s*0 -3px 0 rgba\(39, 45, 48, \.5\)/);
  });

  it('renders safe external visual-review links and preserves structural evidence', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        language="en"
        message={{
          id: 'arv-review', role: 'assistant', content: 'Review the condition.', type: 'arv_visual_comp_review',
          data: {
            propertyId: 'e86dd292-429d-4b51-9b02-bc60a3e9068f', targetCondition: 'FULL_RENOVATION',
            targetConditionEvidenceStatus: 'USER_PROVIDED', summary: { reviewedCount: 0,
              totalStructuralCandidates: 1, status: 'NOT_STARTED' },
            arvEvaluation: { status: 'ARV_LIMITED', arvRangeLow: 1800000, arvRangeHigh: 2400000,
              centralReference: 2100000, confidence: 'LOW', eligibleCompCount: 2,
              confidenceReasons: [], warnings: ['VALUATION_DISPERSION_WARNING'], valuationSet: [{
                compIdentifier: 'rentcast-436', address: '436 Kekauluohi St, Honolulu, HI 96825',
                valuationRole: 'PRIMARY', valuationEligibility: 'INCLUDED', recordedSalePrice: 1550000,
                recordedSaleDate: '2026-04-08T00:00:00.000Z', recordedPricePerSqft: 865.92,
                structuralComparabilityScore: 84.5, dataCompletenessScore: 70,
                conditionCompatibility: 'MATCHES_TARGET', valuationWeight: 0.52, exclusionReason: null,
              }] },
            candidates: [{ stableCompIdentifier: 'rentcast-436',
              address: { line1: '436 Kekauluohi St', city: 'Honolulu', state: 'HI', zipCode: '96825' },
              structuralComparabilityScore: 84.5, dataCompletenessScore: 70, distanceMiles: .64,
              recordedSalePrice: 1550000, recordedSaleDate: '2026-04-08T00:00:00.000Z', review: null }],
          },
        }}
      />,
    );
    expect(html).toContain('436 Kekauluohi St');
    expect(html).toContain('Structural Match: 84.5%');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('Zillow ↗');
    expect(html).toContain('Redfin ↗');
    expect(html).toContain('No MAO is calculated');
    expect(html).toContain('$1,800,000 – $2,400,000');
    expect(html).toContain('Central reference</small><strong>$2,100,000');
    expect(html).toContain('Confidence <strong>LOW</strong>');
    expect(html).toContain('LIMITED CONFIDENCE');
    expect(html).toContain('VALUATION DISPERSION WARNING');
    expect(html).toContain('View evidence');
  });

  it('renders Deal Intelligence answer-first with profile-fit semantics and no unavailable ARV value', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        language="en"
        message={{ id: 'deal-intelligence', role: 'assistant', content: 'Structured deal context.',
          type: 'deal_insight', data: { dealIntelligence: {
            type: 'deal_intelligence_context', evidenceSummary: { strength: 'LOW' },
            matchContext: { classification: 'low', semantics: 'PROFILE_FIT_ONLY' },
            valuationContext: { status: 'ARV_UNAVAILABLE', range: null, centralReference: null, confidence: 'LOW' },
            response: { initialAssessment: 'Based on available evidence, profile alignment is limited.',
              why: ['The market is outside the configured target.'],
              nextSteps: ['Verify the target market preference.'] },
            risks: [{ code: 'TARGET_MARKET_MISMATCH', category: 'MARKET_RISK', severity: 'HIGH',
              explanation: 'The property is outside the configured target market.' }],
            opportunities: [], limitations: ['ARV_EVALUATION_NOT_LOADED'],
          } } }}
      />,
    );
    expect(html).toContain('Initial assessment');
    expect(html).toContain('Profile fit');
    expect(html).toContain('ARV UNAVAILABLE');
    expect(html).toContain('Main risks');
    expect(html).toContain('Suggested next steps');
    expect(html).not.toContain('$0');
    expect(html).not.toMatch(/good deal|buy this property|guaranteed return/i);
  });

  it('renders the Level 2 Maxxis Analysis sections without Deal Intelligence output', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        language="en"
        message={{ id: 'maxxis-analysis', role: 'assistant', content: '75% profile fit.',
          type: 'maxxis_analysis_report', data: { maxxisAnalysisReport: {
            type: 'maxxis_analysis_report', executiveSummary: 'The available information indicates 75% Investment Profile fit.',
            propertyHighlights: {
              verified: [{ field: 'propertyType', label: 'Property type', value: 'Single Family' }],
              userProvided: [{ field: 'city', label: 'City', value: 'Austin' }],
              unknown: [{ field: 'yearBuilt', label: 'Year built', value: null }],
            },
            profileAlignment: { score: 75,
              targetMarket: { label: 'Target market', status: 'ALIGNED', explanation: 'Location matches the target market.' },
              propertyType: { label: 'Property type', status: 'ALIGNED', explanation: 'Type matches the profile.' },
              strategy: { label: 'Strategy', status: 'UNKNOWN', explanation: 'Strategy is unknown.' } },
            keyObservations: { positives: ['Location matches the target market.'], attention: ['Year built is unknown.'] },
            riskAwareness: [{ code: 'UNKNOWN_PROPERTY_FIELDS', category: 'DATA_RISK', severity: 'MEDIUM', explanation: 'Some fields remain unknown.' }],
            limitations: ['Match Score measures Investment Profile fit only.'],
            nextSteps: ['Confirm the year built.'],
          } } }}
      />,
    );
    expect(html).toContain('Maxxis Analysis');
    expect(html).toContain('Property highlights');
    expect(html).toContain('Profile fit');
    expect(html).toContain('PROFILE FIT ONLY');
    expect(html).toContain('Limitations');
    expect(html).toContain('Next steps');
    expect(html).not.toContain('Deal Intelligence');
    expect(html).not.toMatch(/ARV|comparables|valuation/i);
  });

  it('renders the premium Deal Intelligence evidence, valuation, comps, risks, and limitations', () => {
    expect(typeof MaxxisDealIntelligenceExperience).toBe('function');
    const html = renderToStaticMarkup(
      <MessageBubble
        language="en"
        message={{ id: 'premium-intelligence', role: 'assistant', content: 'Evidence-based overview.',
          type: 'maxxis_deal_intelligence', data: { maxxisDealIntelligence: {
            type: 'maxxis_deal_intelligence_report', executiveDealOverview: 'Based on available evidence, valuation confidence is limited.',
            whyThisPropertyStandsOut: [{ code: 'VERIFIED_PROPERTY_EVIDENCE_AVAILABLE', source: 'VERIFIED_RECORD', explanation: 'Verified evidence is available.' }],
            investmentFit: { score: 75, requiredMessage: 'Match Score indicates profile compatibility, not investment quality.',
              targetMarket: { status: 'matched' }, strategy: { status: 'not_evaluated' }, propertyType: { status: 'matched' } },
            valuationIntelligence: { status: 'ARV_LIMITED', range: { low: 380000, high: 430000 }, confidence: 'LOW', compsUsed: 2,
              methodology: 'DEALSIFTER_WEIGHTED_ARV_V1', warnings: ['VALUATION_DISPERSION_WARNING'] },
            comparableEvidence: { used: [{ compIdentifier: 'comp-1', address: '100 Example St', saleDate: '2026-04-08', distanceMiles: .6,
              similarity: 88, conditionStatus: 'MATCHES_TARGET', transactionQuality: 'ARMS_LENGTH_VERIFIED', role: 'PRIMARY', inclusionReason: 'CONDITION_MATCH' }], supporting: [], excluded: [] },
            riskAnalysis: [{ code: 'UNKNOWN_CONDITION', category: 'DATA_RISK', severity: 'HIGH', reason: 'Property condition is unknown.' }],
            limitations: ['property_condition_unknown'], nextVerificationSteps: ['Confirm the target condition.'],
          } } }}
      />,
    );
    expect(html).toContain('Maxxis Deal Intelligence');
    expect(html).toContain('$380,000 – $430,000');
    expect(html).toContain('100 Example St');
    expect(html).toContain('0.6 mi');
    expect(html).toContain('Similarity: 88%');
    expect(html).toContain('Match Score indicates profile compatibility, not investment quality.');
    expect(html).toContain('Risk analysis');
    expect(html).toContain('Limitations');
    expect(html).not.toMatch(/good deal|buy this property|guaranteed return/i);
  });
});
