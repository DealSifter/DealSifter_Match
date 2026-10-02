const text = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

const normalize = (value: unknown) => text(value)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function semanticFamily(value: string) {
  const normalized = normalize(value);
  const families: Array<[RegExp[], string]> = [
    [[/verif/, /data|dados|inform|evidence|evidenc/], 'VERIFY_DATA'],
    [[/arv/, /unavailable|indispon|defens/], 'ARV_UNAVAILABLE'],
    [[/condition|condicao|condicion/, /unknown|confirm|verif/], 'CONDITION_UNKNOWN'],
    [[/rehab|reforma|renov/, /scope|escopo|alcance|cost|custo|presupuesto/], 'REHAB_SCOPE'],
    [[/provider|provedor/, /estimate|estimativa|estimacion/, /arv/], 'PROVIDER_NOT_ARV'],
    [[/cap rate|capitalizacao|capitalizacion/, /reported|informad/], 'CAP_RATE_REPORTED'],
    [[/match|aderencia|compatibilidad/, /quality|qualidade|calidad/], 'MATCH_NOT_QUALITY'],
  ];
  const match = families.find(([patterns]) => patterns.every((pattern) => pattern.test(normalized)));
  return match?.[1] || '';
}

function tokenSet(value: string) {
  const ignored = new Set(['the', 'a', 'an', 'to', 'of', 'and', 'or', 'is', 'are', 'this', 'that', 'o', 'a', 'os', 'as', 'de', 'do', 'da', 'e', 'ou', 'el', 'la', 'los', 'las', 'y']);
  return new Set(normalize(value).split(' ').filter((token) => token.length > 2 && !ignored.has(token)));
}

function similar(left: string, right: string) {
  const leftFamily = semanticFamily(left);
  const rightFamily = semanticFamily(right);
  if (leftFamily && leftFamily === rightFamily) return true;
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return false;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / Math.min(a.size, b.size) >= 0.72;
}

export function dedupeSemanticStatements(values: unknown[] = [], alreadyUsed: string[] = []) {
  const accepted = alreadyUsed.map(text).filter(Boolean);
  for (const raw of values) {
    const candidate = text(raw);
    if (!candidate || accepted.some((existing) => similar(existing, candidate))) continue;
    accepted.push(candidate);
  }
  return accepted.slice(alreadyUsed.length);
}

export function dedupeAnalysisSections(sections: Record<string, unknown[]>, order: string[]) {
  const used: string[] = [];
  const output: Record<string, readonly string[]> = {};
  for (const key of order) {
    const unique = dedupeSemanticStatements(Array.isArray(sections[key]) ? sections[key] : [], used);
    used.push(...unique);
    output[key] = Object.freeze(unique);
  }
  return Object.freeze(output);
}
