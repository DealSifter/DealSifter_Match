// Protection operates on presentation copies only; source records never change.
export function protectNarrativeIdentifiers(text: string, protectedNames: string[] = []) {
  const tokens: string[] = [];
  let protectedText = text;
  const protect = (value: string) => { const token = `__DS_KEEP_${tokens.length}__`; tokens.push(value); return token; };
  for (const name of [...new Set(protectedNames)].filter(Boolean).sort((a, b) => b.length - a.length)) {
    protectedText = protectedText.replaceAll(name, () => protect(name));
  }
  protectedText = protectedText.replace(/__DS_KEEP_\d+__|https?:\/\/[^\s]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|["“][^"”\n]+["”]|\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+|[A-Z]{2,}(?:-[A-Z0-9]+)*)\b|(?:\+?\d[\d (),./$%-]*\d|\d)/g,
    value => /^__DS_KEEP_\d+__$/.test(value) ? value : protect(value));
  return { text: protectedText, tokens };
}
export function restoreNarrativeIdentifiers(translated: string, tokens: string[]) {
  for (let index = 0; index < tokens.length; index++) {
    const marker = `__DS_KEEP_${index}__`;
    // Missing/duplicated/mutated identifiers invalidate the whole translation.
    if (translated.split(marker).length !== 2) return null;
  }
  if ((translated.match(/__DS_KEEP_\d+__/g) || []).length !== tokens.length) return null;
  return translated.replace(/__DS_KEEP_(\d+)__/g, (_, index) => tokens[Number(index)]);
}
