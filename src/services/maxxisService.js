import { getLang } from '../i18n/translations';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const MAX_HISTORY_ITEMS = 10;

const FALLBACK_MESSAGES = {
  en: 'Maxxis is not available right now. Please try again in a moment or contact human support.',
  pt: 'O Maxxis nao esta disponivel agora. Tente novamente em instantes ou fale com o suporte humano.',
  es: 'Maxxis no esta disponible ahora. Intentalo de nuevo en un momento o contacta al soporte humano.',
};

const CONFIG_MESSAGES = {
  en: 'Maxxis AI still needs to be configured by support. The conversation widget is ready, but the backend AI key is missing.',
  pt: 'O Maxxis AI ainda precisa ser configurado pelo suporte. O chat ja esta pronto, mas falta a chave de IA no backend.',
  es: 'Maxxis AI todavia debe ser configurado por soporte. El chat ya esta listo, pero falta la clave de IA en el backend.',
};

function currentLanguage() {
  const lang = String(getLang?.() || 'en').slice(0, 2).toLowerCase();
  return ['en', 'pt', 'es'].includes(lang) ? lang : 'en';
}

function normalizeHistory(history = []) {
  return (Array.isArray(history) ? history : [])
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user',
      content: String(item?.content || '').slice(0, 1800),
    }))
    .filter((item) => item.content.trim());
}

export function getMaxxisGreeting(language = currentLanguage()) {
  if (language === 'pt') {
    return 'Ola, eu sou o Maxxis, seu assistente do DealSifter Match. Posso te ajudar a navegar pelo Feed, MapView, Matches, desbloqueios, planos, nuggets, spotlight e conceitos gerais de Tax Deed ou Wholesale nos EUA. Como posso ajudar agora?';
  }
  if (language === 'es') {
    return 'Hola, soy Maxxis, tu asistente de DealSifter Match. Puedo ayudarte con Feed, MapView, Matches, desbloqueos, planes, nuggets, spotlight y conceptos generales de Tax Deed o Wholesale en EE. UU. Que necesitas ahora?';
  }
  return 'Hi, I am Maxxis, your DealSifter Match assistant. I can help you with Feed, MapView, Matches, unlocks, plans, nuggets, spotlight, and general US Tax Deed or Wholesale concepts. How can I help?';
}

export async function sendMaxxisMessage({ message, history = [], page = 'dashboard', language = currentLanguage() }) {
  const text = String(message || '').trim();
  if (!text) throw new Error('Message is required.');
  if (!isSupabaseConfigured || !supabase) {
    return {
      answer: FALLBACK_MESSAGES[language] || FALLBACK_MESSAGES.en,
      unavailable: true,
    };
  }

  const { data, error } = await supabase.functions.invoke('maxxis-chat', {
    body: {
      message: text,
      history: normalizeHistory(history),
      page,
      language,
    },
  });

  if (error) {
    const status = Number(error?.context?.status || error?.status || 0);
    if (status === 503) {
      return {
        answer: CONFIG_MESSAGES[language] || CONFIG_MESSAGES.en,
        unavailable: true,
      };
    }
    throw error;
  }

  if (data?.error === 'MAXXIS_NOT_CONFIGURED') {
    return {
      answer: CONFIG_MESSAGES[language] || CONFIG_MESSAGES.en,
      unavailable: true,
    };
  }

  return {
    answer: String(data?.answer || '').trim() || (FALLBACK_MESSAGES[language] || FALLBACK_MESSAGES.en),
    unavailable: Boolean(data?.unavailable),
  };
}
