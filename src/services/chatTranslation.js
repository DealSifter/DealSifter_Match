const BACKEND_TRANSLATE_URL = import.meta.env.VITE_TRANSLATE_API_URL || '';

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

function detectLanguage(text) {
  const input = String(text || '').toLowerCase();
  if (!input.trim()) return 'pt';

  const ptSignal = /(voce|voces|obrigad|nao|imovel|negocio|contato|preco|ola|oi)\b/;
  const esSignal = /(usted|ustedes|gracias|propiedad|precio|contacto|hola|si)\b/;

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

export async function translateChatText({ text, fromLang, toLang }) {
  const source = fromLang === 'auto' ? detectLanguage(text) : normalizeLang(fromLang);
  const target = normalizeLang(toLang);

  if (!String(text || '').trim()) {
    return { text: '', fromLang: source, toLang: target, provider: 'none' };
  }

  if (source === target) {
    return { text, fromLang: source, toLang: target, provider: 'none' };
  }

  const backend = await translateWithBackend(text, source, target);
  if (backend) {
    return {
      text: backend.text,
      fromLang: source,
      toLang: target,
      provider: backend.provider,
    };
  }

  const localTranslated = localDictionaryTranslate(text, source, target);
  return {
    text: localTranslated,
    fromLang: source,
    toLang: target,
    provider: 'local-dictionary',
  };
}

export function getSafeLang(lang, fallback = 'pt') {
  const value = normalizeLang(lang);
  return value || fallback;
}
