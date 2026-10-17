/** Acquisition contract shared by Edge, frontend and legacy translation-cache reads.
 * Only narrative text, or the exact documented { translation: string } envelope,
 * may cross into presentation. No arbitrary object is stringified or displayed.
 */
const MAX_TRANSLATION_LENGTH = 24_000;
const serializedArtifact = /\[object Object\]|(?:^|\n)\s*```|(?:^|\n)\s*[\[{]\s*["'{\[]/;
const invalidLiteral = /^(?:undefined|NaN|Infinity|null|true|false)$/;

function narrativeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > MAX_TRANSLATION_LENGTH || invalidLiteral.test(text)
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)
    || serializedArtifact.test(text) || /^[\[{]/.test(text)) return null;
  return text;
}

function envelope(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== 'translation') return null;
  return narrativeString((value as { translation: unknown }).translation);
}

/** Strict schema: string | { translation: string }; serialized envelopes parse once.
 * An invalid response returns null; callers retain the original safe source text.
 */
export function parsePresentationTranslation(input: unknown): string | null {
  if (typeof input !== 'string') return envelope(input);
  const text = input.trim();
  if (text.length > MAX_TRANSLATION_LENGTH) return null;
  if (text.startsWith('{') || text.startsWith('[')) {
    try { return envelope(JSON.parse(text)); } catch { return null; }
  }
  return narrativeString(text);
}

export function safeOriginalNarrative(input: unknown): string {
  // Source notes are never mutated. A structured/invalid source is not safe copy.
  return narrativeString(input) !== null && typeof input === 'string' ? input : '';
}
