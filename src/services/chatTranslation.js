import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { protectNarrativeIdentifiers, restoreNarrativeIdentifiers } from '../../supabase/functions/_shared/presentationText';

const BACKEND_TRANSLATE_URL = import.meta.env.VITE_TRANSLATE_API_URL || '';
const presentationCache = new Map();
const pendingPresentations = new Map();

export const CHAT_LANGUAGE_OPTIONS = [
  { code: 'pt', label: 'Portugues' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Espanol' },
];

const WORD_MAP = {
  'pt->en': {
    ola: 'hello',
    oi: 'hi',
    bom: 'good',
    boa: 'good',
    dia: 'morning',
    tarde: 'afternoon',
    noite: 'night',
    obrigado: 'thanks',
    obrigada: 'thanks',
    por: 'for',
    favor: 'please',
    sim: 'yes',
    nao: 'no',
    casa: 'house',
    imovel: 'property',
    preco: 'price',
    fechado: 'closed',
    negocio: 'deal',
    contato: 'contact',
    portfolio: 'portfolio',
  },
  'en->pt': {
    hello: 'ola',
    hi: 'oi',
    good: 'bom',
    morning: 'dia',
    afternoon: 'tarde',
    night: 'noite',
    thanks: 'obrigado',
    please: 'por favor',
    yes: 'sim',
    no: 'nao',
    house: 'casa',
    property: 'imovel',
    price: 'preco',
    closed: 'fechado',
    deal: 'negocio',
    contact: 'contato',
    portfolio: 'portfolio',
  },
  'pt->es': {
    ola: 'hola',
    oi: 'hola',
    obrigado: 'gracias',
    obrigada: 'gracias',
    por: 'por',
    favor: 'favor',
    sim: 'si',
    nao: 'no',
    casa: 'casa',
    imovel: 'propiedad',
    preco: 'precio',
    negocio: 'negocio',
    contato: 'contacto',
  },
  'es->pt': {
    hola: 'ola',
    gracias: 'obrigado',
    por: 'por',
    favor: 'favor',
    si: 'sim',
    no: 'nao',
    casa: 'casa',
    propiedad: 'imovel',
    precio: 'preco',
    negocio: 'negocio',
    contacto: 'contato',
  },
  'en->es': {
    hello: 'hola',
    hi: 'hola',
    thanks: 'gracias',
    please: 'por favor',
    yes: 'si',
    no: 'no',
    house: 'casa',
    property: 'propiedad',
    price: 'precio',
    deal: 'negocio',
    contact: 'contacto',
  },
  'es->en': {
    hola: 'hello',
    gracias: 'thanks',
    favor: 'please',
    si: 'yes',
    no: 'no',
    casa: 'house',
    propiedad: 'property',
    precio: 'price',
    negocio: 'deal',
    contacto: 'contact',
  },
};

function normalizeLang(lang) {
  if (!lang) return 'pt';
  const value = String(lang).toLowerCase().trim();
  if (value.startsWith('pt')) return 'pt';
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('es')) return 'es';
  return 'pt';
}

export function detectLanguage(text) {
  const raw = String(text || '').toLowerCase().replace(/https?:\/\/\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}/g, '');
  if (!raw.trim()) return 'pt';
  // Strip diacritics: "você" → "voce", "imóvel" → "imovel", "não" → "nao"
  const input = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // \b does not work reliably with non-ASCII characters in JS.
  // Use a lookahead/lookbehind for non-word chars (spaces, punctuation, string boundaries).
  const wordBoundary = '(?<![\\w\u00C0-\u024F])';
  const wordBoundaryEnd = '(?![\\w\u00C0-\u024F])';
  const ptSignal = new RegExp(wordBoundary + '(voce|voces|obrigad|nao|imovel|negocio|contato|preco|ola|oi|bem|vindo|com|uma|para|piscina|quartos)' + wordBoundaryEnd, 'u');
  const esSignal = new RegExp(wordBoundary + '(usted|ustedes|gracias|propiedad|precio|contacto|hola|si|bienvenido|con|una|habitaciones)' + wordBoundaryEnd, 'u');

  if (ptSignal.test(input)) return 'pt';
  if (esSignal.test(input)) return 'es';
  return 'en';
}

async function translateWithBackend(text, fromLang, toLang) {
  if (!BACKEND_TRANSLATE_URL) return null;

  try {
    const response = await fetch(BACKEND_TRANSLATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, fromLang, toLang }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.translatedText || typeof data.translatedText !== 'string') return null;

    return {
      text: data.translatedText,
      provider: 'backend',
    };
  } catch (e) { void e; return null; }
}

function localDictionaryTranslate(text, fromLang, toLang) {
  const map = WORD_MAP[`${fromLang}->${toLang}`];
  if (!map) return text;

  return String(text)
    .split(/(\s+)/)
    .map((token) => {
      const isSpace = /^\s+$/.test(token);
      if (isSpace) return token;

      const stripped = token.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (!stripped) return token;
      const translated = map[stripped];
      if (!translated) return token;

      const startsUpper = /^[A-Z]/.test(token);
      const withCase = startsUpper
        ? translated.charAt(0).toUpperCase() + translated.slice(1)
        : translated;

      return token.replace(new RegExp(stripped, 'i'), withCase);
    })
    .join('');
}

export async function translateChatText({ text, fromLang, toLang, presentationOnly = false, protectedNames = [], invoke = null }) {
  const source = fromLang === 'auto' ? detectLanguage(text) : normalizeLang(fromLang);
  const target = normalizeLang(toLang);

  if (!String(text || '').trim()) {
    return { text: '', fromLang: source, toLang: target, provider: 'none' };
  }

  if (source === target) {
    return { text, fromLang: source, toLang: target, provider: 'none' };
  }

  if (presentationOnly && !BACKEND_TRANSLATE_URL) {
    try {
      const translate = invoke || (isSupabaseConfigured && supabase
        ? body => supabase.functions.invoke('presentation-translate', { body }) : null);
      if (!translate) return { text, fromLang: source, toLang: target, provider: 'original' };
      const { data, error } = await translate({ text, fromLang: source, toLang: target, protectedNames });
      if (error || typeof data?.translatedText !== 'string') return { text, fromLang: source, toLang: target, provider: 'original' };
      return { text: data.translatedText, fromLang: source, toLang: target,
        provider: data.translationSource || 'backend', translatedAt: data.translatedAt || null };
    } catch { return { text, fromLang: source, toLang: target, provider: 'original' }; }
  }

  const protectedCopy = presentationOnly ? protectNarrativeIdentifiers(text, protectedNames) : null;
  const backend = await translateWithBackend(protectedCopy?.text || text, source, target);
  if (backend) {
    const translatedText = protectedCopy ? restoreNarrativeIdentifiers(backend.text, protectedCopy.tokens) : backend.text;
    return {
      text: translatedText || text,
      fromLang: source,
      toLang: target,
      provider: translatedText ? backend.provider : 'original',
    };
  }

  if (presentationOnly) return { text, fromLang: source, toLang: target, provider: 'original' };
  const localTranslated = localDictionaryTranslate(text, source, target);
  return {
    text: localTranslated,
    fromLang: source,
    toLang: target,
    provider: 'local-dictionary',
  };
}

// Read-only presentation model, independently cached from provider evidence.
const presentationKey = (text, locale) => `${normalizeLang(locale)}:${String(text || '')}`;
export function getCachedPresentationText(text, locale) {
  return presentationCache.get(presentationKey(text, locale))?.translatedText ?? text;
}
export async function localizePresentationText({ text, sourceLocale = 'auto', targetLocale, protectedNames = [], invoke = null }) {
  const sourceText = String(text ?? '');
  const target = normalizeLang(targetLocale), source = sourceLocale === 'auto' ? detectLanguage(sourceText) : normalizeLang(sourceLocale);
  const key = presentationKey(sourceText, target);
  if (presentationCache.has(key)) return presentationCache.get(key);
  if (pendingPresentations.has(key)) return pendingPresentations.get(key);
  const pending = (async () => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sourceText));
    const sourceHash = [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
    const result = await translateChatText({ text: sourceText, fromLang: source, toLang: target, presentationOnly: true, protectedNames, invoke });
    const model = Object.freeze({ sourceText, sourceHash, sourceLocale: source, targetLocale: target,
      translatedText: result.text, translatedAt: result.translatedAt || null, translationSource: result.provider,
      evidenceStatus: 'USER_PROVIDED' });
    presentationCache.set(key, model);
    // Bounded device-session cache. Durable, user-scoped deduplication is server-side.
    if (presentationCache.size > 300) presentationCache.delete(presentationCache.keys().next().value);
    return model;
  })();
  pendingPresentations.set(key, pending);
  try { return await pending; } finally { pendingPresentations.delete(key); }
}

export function getSafeLang(lang, fallback = 'pt') {
  const value = normalizeLang(lang);
  return value || fallback;
}
