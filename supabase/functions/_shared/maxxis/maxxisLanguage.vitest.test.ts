import { describe, expect, it } from 'vitest';
import { resolveMaxxisLanguage } from './maxxisLanguage.ts';

describe('Maxxis app-language authority', () => {
  it.each(['en', 'pt', 'es'] as const)('keeps the selected %s language even when the message uses another language', (language) => {
    expect(resolveMaxxisLanguage('Preciso analisar este imóvel', language)).toBe(language);
    expect(resolveMaxxisLanguage('I need to analyze this property', language)).toBe(language);
  });

  it('detects message language only when the app preference is auto', () => {
    expect(resolveMaxxisLanguage('Preciso analisar este imóvel', 'auto')).toBe('pt');
    expect(resolveMaxxisLanguage('Puedes analizar esta propiedad', 'auto')).toBe('es');
  });
});
