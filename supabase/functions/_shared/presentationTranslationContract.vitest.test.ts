import { describe, expect, it } from 'vitest';
import { parsePresentationTranslation, safeOriginalNarrative } from './presentationTranslationContract.ts';
import { protectNarrativeIdentifiers, restoreNarrativeIdentifiers } from './presentationText.ts';

describe('strict narrative translation acquisition contract', () => {
  it.each([
    ['Bem-vindo à propriedade.', 'Bem-vindo à propriedade.'],
    [{ translation: 'Bem-vindo à propriedade.' }, 'Bem-vindo à propriedade.'],
    ['{"translation":"Bem-vindo à propriedade."}', 'Bem-vindo à propriedade.'],
    ['  { "translation": "Piscina privativa." }  ', 'Piscina privativa.'],
  ])('only emits the narrative string from an approved schema (%j)', (input, expected) => {
    expect(parsePresentationTranslation(input)).toBe(expected);
  });

  it.each([
    undefined, null, 0, false, [], ['text'], {},
    { translatedText: 'wrapper not part of the model contract' },
    { translation: 'text', explanation: 'additional key' },
    { translation: { translation: 'nested object' } },
    { translation: '[object Object]' },
    { translation: '{"translation":"nested string envelope"}' },
    '{"translation":', '{"text":"not a supported envelope"}',
    '[{"translation":"array"}]',
    '```json\n{"translation":"markdown wrapper"}\n```',
    'Model response:\n{"translation":"raw wrapper in prose"}',
    '[object Object]', 'undefined', 'NaN', 'Infinity', '\u0000invalid',
    'x'.repeat(24_001),
  ])('rejects unrecognized or unsafe responses without serializing (%j)', input => {
    expect(parsePresentationTranslation(input)).toBeNull();
  });

  it('does not turn class instances into valid response envelopes', () => {
    class Wrapper { translation = 'not a JSON object'; }
    expect(parsePresentationTranslation(new Wrapper())).toBeNull();
  });

  it('parses before restoring protected identifiers and fails closed on lost tokens', () => {
    const source = 'Welcome to 4724 W 26th St. APN 34L-136.00-066.00.';
    const protectedCopy = protectNarrativeIdentifiers(source);
    const parsed = parsePresentationTranslation(JSON.stringify({ translation: protectedCopy.text.replace('Welcome to', 'Bem-vindo a') }));
    expect(restoreNarrativeIdentifiers(parsed!, protectedCopy.tokens)).toBe(source.replace('Welcome to', 'Bem-vindo a'));
    expect(restoreNarrativeIdentifiers('Identificadores perdidos.', protectedCopy.tokens)).toBeNull();
  });

  it('falls back only to an unchanged safe source, never a source object or payload', () => {
    const source = '  Original property notes.  ';
    expect(safeOriginalNarrative(source)).toBe(source);
    expect(safeOriginalNarrative({ text: 'must not stringify' })).toBe('');
    expect(safeOriginalNarrative('{"translation":"must not display wrapper"}')).toBe('');
  });
});
