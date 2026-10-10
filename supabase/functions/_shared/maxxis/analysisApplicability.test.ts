import { describe, expect, it } from 'vitest';
import {
  classifyAnalysisApplicability,
  isVacantLandProperty,
  normalizeTargetCondition,
} from './analysisApplicability.ts';

describe('Maxxis analysis applicability', () => {
  it.each([
    ['No estado atual', 'AS_IS'],
    ['Reforma leve', 'LIGHT_REHAB'],
    ['Reforma padrão', 'STANDARD_RENOVATION'],
    ['Reforma completa', 'FULL_RENOVATION'],
    ['Pronto para uso', 'TURN_KEY'],
  ])('maps localized condition %s to %s', (label, canonical) => {
    expect(normalizeTargetCondition(label)).toBe(canonical);
  });

  it.each(['Land', 'LOT', 'vacant_land', 'Terreno', 'Lote'])('recognizes %s as vacant land', (type) => {
    expect(isVacantLandProperty({ type })).toBe(true);
  });

  it('classifies land without construction as rehab and residential ARV not applicable', () => {
    expect(classifyAnalysisApplicability(
      { type: 'Land' },
      { targetCondition: 'AS_IS', renovationScope: 'é um terreno, não haverá construção' },
    )).toMatchObject({
      propertyCategory: 'VACANT_LAND', constructionPlanned: false,
      rehab: 'NOT_APPLICABLE', residentialArv: 'NOT_APPLICABLE',
    });
  });

  it('allows a land improvement workflow only when construction is explicit', () => {
    expect(classifyAnalysisApplicability({ type: 'Land' }, { targetCondition: 'NEW_CONSTRUCTION' }))
      .toMatchObject({ constructionPlanned: true, rehab: 'NOT_APPLICABLE', residentialArv: 'NOT_APPLICABLE' });
  });
});
