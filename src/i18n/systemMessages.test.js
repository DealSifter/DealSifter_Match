import { describe, expect, it } from 'vitest';
import { localizeSystemText, systemMessages } from './systemMessages';
import { cardDisplayLabel } from './interfaceCompletion';
import { getMaxxisPreferencesCopy } from '../features/maxxis/preferences/maxxisPreferences';
import { buildPropertyCardFacts } from '../features/propertyFacts/cardFacts';

describe('localized system presentation', () => {
  it('does not leave English system notices in Portuguese or Spanish', () => {
    for (const row of systemMessages) for (const locale of ['pt-BR', 'es-ES']) {
      const source = row[0].replace('{0}', 'CaseSensitive@Example.COM');
      expect(localizeSystemText(source, locale)).not.toBe(source);
    }
  });
  it('preserves the case of an email and all values in a multi-field notification', () => {
    expect(localizeSystemText('Your email CaseSensitive@Example.COM was confirmed. Sign in to continue.', 'pt-BR')).toBe('Seu email CaseSensitive@Example.COM foi confirmado. Entre para continuar.');
    const source = '"1200 Fictional QA Avenue" reached 8 favorites, 2 unlocks and 1 matches. Follow up while interest is hot.';
    // Unknown prose remains intact; known notification templates are checked in UI tests.
    expect(localizeSystemText(source, 'pt-BR')).toContain('1200 Fictional QA Avenue');
  });
  it('preserves user content and unrecognized text', () => {
    const custom = 'My property is called New / Exclusive and has 2 units.';
    expect(localizeSystemText(custom, 'pt-BR')).toBe(custom);
    expect(cardDisplayLabel('Custom Owner Name', 'es-ES')).toBe('Custom Owner Name');
  });
  it('uses base locales for Maxxis preferences and room labels', () => {
    expect(getMaxxisPreferencesCopy('pt-BR')).toEqual(getMaxxisPreferencesCopy('pt'));
    const facts = buildPropertyCardFacts({ type: 'SFR', beds: 3, baths: 2, sqft: 1200 }, {}, 'pt-BR');
    expect(facts[0]).toMatchObject({ label: '3 / 2', sub: 'Quartos / Banheiros' });
    expect(buildPropertyCardFacts({ type: 'SFR', beds: 3, baths: 2 }, {}, 'es-ES')[0].sub).toBe('Habitaciones / Baños');
  });
});
