import { getLang } from '../i18n/translations';
import {
  getSupabaseFunctionUrl,
  isSupabaseConfigured,
  supabase,
  supabaseAnonKey,
} from '../lib/supabaseClient';
import { captureOperationalMetric } from '../lib/observability';
import { normalizeMaxxisResponsePayload } from '../domain/maxxis/responseTypes';
import {
  maxxisContextTelemetry,
  sanitizeMaxxisContextSnapshot,
} from '../features/maxxis/context/maxxisContextSnapshot';

const MAX_HISTORY_ITEMS = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FALLBACK_MESSAGES = {
  en: 'Maxxis Deal AI is not available right now. Please try again in a moment or contact human support.',
  pt: 'O Maxxis Deal AI nao esta disponivel agora. Tente novamente em instantes ou fale com o suporte humano.',
  es: 'Maxxis Deal AI no esta disponible ahora. Intentalo de nuevo en un momento o contacta al soporte humano.',
};

const CONFIG_MESSAGES = {
  en: 'Maxxis Deal AI still needs to be configured by support. The conversation widget is ready, but the backend AI key is missing.',
  pt: 'O Maxxis Deal AI ainda precisa ser configurado pelo suporte. O chat ja esta pronto, mas falta a chave de IA no backend.',
  es: 'Maxxis Deal AI todavia debe ser configurado por soporte. El chat ya esta listo, pero falta la clave de IA en el backend.',
};

const AUTH_MESSAGES = {
  en: 'Please sign in again so Maxxis Deal AI can answer with your DealSifter context.',
  pt: 'Entre novamente na sua conta para que o Maxxis Deal AI responda com o contexto do DealSifter.',
  es: 'Inicia sesion nuevamente para que Maxxis Deal AI responda con el contexto de DealSifter.',
};

const LOCAL_ANSWER_CATALOG = {
  greeting: {
    en: 'Hi, I am here. I can guide you through Feed, MapView, Matches, unlocks, nuggets, plans and deal basics. Tell me what you want to do next.',
    pt: 'Oi, estou aqui. Posso te orientar no Feed, MapView, Matches, desbloqueios, nuggets, planos e conceitos dos negocios. Me diga o que voce quer fazer agora.',
    es: 'Hola, estoy aqui. Puedo orientarte en Feed, MapView, Matches, desbloqueos, nuggets, planes y conceptos de negocios. Dime que quieres hacer ahora.',
  },
  nuggets: {
    en: 'Nuggets are used to unlock protected contacts, cards and selected premium actions. If your balance is not enough, go to Plans/Pricing to add more before trying the unlock again.',
    pt: 'Nuggets sao usados para desbloquear contatos, cards protegidos e algumas acoes premium. Se o saldo nao for suficiente, va em Planos/Pricing para comprar mais antes de tentar o desbloqueio novamente.',
    es: 'Los nuggets se usan para desbloquear contactos, cards protegidos y algunas acciones premium. Si el saldo no alcanza, ve a Planes/Pricing antes de intentar desbloquear otra vez.',
  },
  map: {
    en: 'In MapView, use the sidebar to inspect deals or providers, filter by state and open cards. The sidebar can be resized and your custom size is remembered.',
    pt: 'No MapView, use a sidebar para inspecionar negocios ou providers, filtrar por estado e abrir cards. A sidebar pode ser redimensionada e o app lembra o tamanho que voce ajustar.',
    es: 'En MapView, usa la sidebar para revisar negocios o providers, filtrar por estado y abrir cards. La sidebar se puede redimensionar y el app recuerda tu ajuste.',
  },
  feed: {
    en: 'In Feed, swipe or use the action buttons to pass, favorite or mark interest. Locked/unlocked status should stay stable after the latest synchronization fixes.',
    pt: 'No Feed, deslize ou use os botoes de acao para recusar, favoritar ou marcar interesse. O status locked/unlocked deve permanecer estavel apos as correcoes de sincronizacao.',
    es: 'En Feed, desliza o usa los botones para rechazar, guardar o marcar interes. El estado locked/unlocked debe mantenerse estable con las correcciones de sincronizacion.',
  },
  matches: {
    en: 'Matches shows mutual or relevant interest signals. Open a match to continue the conversation, review unlocked contact status or decide the next action.',
    pt: 'Matches mostra sinais de interesse mutuo ou relevante. Abra um match para continuar a conversa, verificar o status de contato desbloqueado ou decidir a proxima acao.',
    es: 'Matches muestra senales de interes mutuo o relevante. Abre un match para continuar la conversacion, revisar contactos desbloqueados o decidir la proxima accion.',
  },
  pricing: {
    en: 'Plans/Pricing is where you manage subscription and nugget packs. Use it when an unlock or premium action requires more balance.',
    pt: 'Planos/Pricing e onde voce gerencia assinatura e pacotes de nuggets. Use quando um desbloqueio ou acao premium exigir mais saldo.',
    es: 'Planes/Pricing es donde gestionas suscripcion y paquetes de nuggets. Usalo cuando un desbloqueo o accion premium requiera mas saldo.',
  },
  default: {
    en: 'I am in local guide mode right now, but I can still help with navigation, Feed, MapView, Matches, unlocks, nuggets, plans and next steps. Current page: {page}.',
    pt: 'Estou em modo guia local neste momento, mas ainda posso ajudar com navegacao, Feed, MapView, Matches, desbloqueios, nuggets, planos e proximos passos. Pagina atual: {page}.',
    es: 'Estoy en modo guia local en este momento, pero aun puedo ayudar con navegacion, Feed, MapView, Matches, desbloqueos, nuggets, planes y proximos pasos. Pagina actual: {page}.',
  },
};

function currentLanguage() {
  const lang = String(getLang?.() || 'en').slice(0, 2).toLowerCase();
  return ['en', 'pt', 'es'].includes(lang) ? lang : 'en';
}

function buildLocalMaxxisAnswer(message, language = currentLanguage(), page = 'dashboard') {
  const lang = ['en', 'pt', 'es'].includes(language) ? language : 'en';
  const normalized = String(message || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  let key = 'default';
  if (/\b(ola|oi|hello|hi|hey|hola)\b/.test(normalized)) key = 'greeting';
  else if (/(nugget|saldo|balance|unlock|desbloq|destravar|bloquead|locked)/.test(normalized)) key = 'nuggets';
  else if (/(map|mapview|mapa|pin|sidebar)/.test(normalized)) key = 'map';
  else if (/(feed|card|swipe|favorit|interest|interesse)/.test(normalized)) key = 'feed';
  else if (/(match|conex|mensagem|message|chat|interessado)/.test(normalized)) key = 'matches';
  else if (/(plan|pricing|preco|price|assinatura|upgrade|comprar)/.test(normalized)) key = 'pricing';
  return (LOCAL_ANSWER_CATALOG[key][lang] || LOCAL_ANSWER_CATALOG[key].en).replace('{page}', String(page || 'dashboard'));
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

async function getMaxxisFunctionHeaders() {
  if (!supabase?.auth?.getSession) return {};
  const { data } = await supabase.auth.getSession();
  let accessToken = data?.session?.access_token || '';
  if (!accessToken && supabase.auth.refreshSession) {
    const refreshed = await supabase.auth.refreshSession().catch(() => null);
    accessToken = refreshed?.data?.session?.access_token || '';
  }
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function invokeMaxxisChatFunction(body) {
  const url = getSupabaseFunctionUrl('maxxis-chat');
  if (!url) throw new Error('MAXXIS_FUNCTION_URL_MISSING');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
      ...(await getMaxxisFunctionHeaders()),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  return {
    ok: response.ok,
    status: response.status,
    data: payload,
    requestId: String(payload?.requestId || response.headers.get('x-request-id') || '').trim(),
  };
}

export function getMaxxisGreeting(language = currentLanguage()) {
  if (language === 'pt') {
    return 'Ola, eu sou o Maxxis Deal AI, seu assistente do DealSifter Match. Posso te ajudar a navegar pelo Feed, MapView, Matches, desbloqueios, planos, nuggets, spotlight e conceitos gerais de Tax Deed ou Wholesale nos EUA. Como posso ajudar agora?';
  }
  if (language === 'es') {
    return 'Hola, soy Maxxis Deal AI, tu asistente de DealSifter Match. Puedo ayudarte con Feed, MapView, Matches, desbloqueos, planes, nuggets, spotlight y conceptos generales de Tax Deed o Wholesale en EE. UU. Que necesitas ahora?';
  }
  return 'Hi, I am Maxxis Deal AI, your DealSifter Match assistant. I can help you with Feed, MapView, Matches, unlocks, plans, nuggets, spotlight, and general US Tax Deed or Wholesale concepts. How can I help?';
}

export async function sendMaxxisMessage({ message, history = [], page = 'dashboard', language = currentLanguage(), propertyId = '', propertyIds = [], maxxisContext = null }) {
  const text = String(message || '').trim();
  if (!text) throw new Error('Message is required.');
  if (!isSupabaseConfigured || !supabase) {
    return {
      answer: buildLocalMaxxisAnswer(text, language, page),
      unavailable: false,
      degraded: true,
      degradedReason: 'MAXXIS_CLIENT_NOT_CONFIGURED',
      requestId: '',
    };
  }

  const trustedPropertyIds = Array.from(new Set(
    (Array.isArray(propertyIds) ? propertyIds : [])
      .map((id) => String(id || '').trim())
      .filter((id) => UUID_PATTERN.test(id)),
  )).slice(0, 20);
  const trustedPropertyId = String(propertyId || '').trim();
  const cleanMaxxisContext = maxxisContext ? sanitizeMaxxisContextSnapshot(maxxisContext) : null;
  const context = {
    ...(UUID_PATTERN.test(trustedPropertyId) ? { propertyId: trustedPropertyId } : {}),
    ...(trustedPropertyIds.length ? { propertyIds: trustedPropertyIds } : {}),
    ...(cleanMaxxisContext ? { maxxisContext: cleanMaxxisContext } : {}),
  };
  const contextTelemetry = cleanMaxxisContext ? maxxisContextTelemetry(cleanMaxxisContext) : null;
  if (contextTelemetry) {
    captureOperationalMetric('maxxis.context', {
      surface: contextTelemetry.surface,
      entity_type: contextTelemetry.entityType,
      context_version: contextTelemetry.contextVersion,
      context_size: contextTelemetry.contextSize,
      freshness_summary: contextTelemetry.freshnessSummary,
    });
  }

  const startedAt = Date.now();
  let data;
  let status = 0;
  let ok = false;
  let requestId = '';
  try {
    const result = await invokeMaxxisChatFunction({
      message: text,
      history: normalizeHistory(history),
      page,
      language,
      ...(Object.keys(context).length ? { context } : {}),
    });
    data = result.data;
    status = result.status;
    ok = result.ok;
    requestId = result.requestId;
  } catch (invokeError) {
    captureOperationalMetric('maxxis.chat', {
      success: false,
      duration_ms: Date.now() - startedAt,
      error_category: 'PROVIDER',
      error_code: String(invokeError?.code || invokeError?.status || 'INVOKE_FAILED').slice(0, 64),
    });
    return {
      answer: buildLocalMaxxisAnswer(text, language, page),
      unavailable: false,
      degraded: true,
      degradedReason: 'GEMINI_NETWORK_ERROR',
      requestId: '',
    };
  }

  if (data?.degraded) {
    captureOperationalMetric('maxxis.chat', {
      success: false,
      duration_ms: Date.now() - startedAt,
      error_category: String(data?.degradedReason || data?.error || '').includes('QUOTA') ? 'QUOTA' : 'PROVIDER',
      error_code: String(data?.degradedReason || data?.error || 'MAXXIS_DEGRADED').slice(0, 64),
      provider_status: status || undefined,
      request_id: requestId || undefined,
    });
    return {
      answer: String(data?.message || data?.answer || '').trim() || buildLocalMaxxisAnswer(text, language, page),
      unavailable: false,
      degraded: true,
      degradedReason: String(data?.degradedReason || data?.error || 'MAXXIS_DEGRADED').slice(0, 64),
      requestId,
    };
  }

  if (!ok || data?.error) {
    captureOperationalMetric('maxxis.chat', {
      success: false,
      duration_ms: Date.now() - startedAt,
      error_category: status === 401 || status === 403 ? 'AUTH' : status === 429 ? 'QUOTA' : 'PROVIDER',
      error_code: String(data?.error || status || 'MAXXIS_REQUEST_FAILED').slice(0, 64),
      provider_status: status || undefined,
      request_id: requestId || undefined,
    });
    if (status === 401 || status === 403) {
      return {
        answer: AUTH_MESSAGES[language] || AUTH_MESSAGES.en,
        unavailable: true,
        requestId,
      };
    }
    if (status >= 400 && data?.message) {
      return {
        answer: String(data.message || data.answer || '').trim() || (FALLBACK_MESSAGES[language] || FALLBACK_MESSAGES.en),
        unavailable: Boolean(data?.unavailable || status >= 500),
        requestId,
      };
    }
    return {
      answer: buildLocalMaxxisAnswer(text, language, page),
      unavailable: false,
      degraded: true,
      degradedReason: String(data?.error || 'MAXXIS_REQUEST_FAILED').slice(0, 64),
      requestId,
    };
  }

  captureOperationalMetric('maxxis.chat', {
    success: true,
    duration_ms: Date.now() - startedAt,
    response_type: String(data?.type || 'text').slice(0, 40),
    request_id: requestId || undefined,
    ...(contextTelemetry ? {
      context_version: contextTelemetry.contextVersion,
      context_size: contextTelemetry.contextSize,
      context_surface: contextTelemetry.surface,
      context_entity_type: contextTelemetry.entityType,
      context_freshness: contextTelemetry.freshnessSummary,
    } : {}),
  });

  const normalizedResponse = normalizeMaxxisResponsePayload(data?.type, data?.data);
  return {
    answer: String(data?.message || data?.answer || '').trim() || (FALLBACK_MESSAGES[language] || FALLBACK_MESSAGES.en),
    unavailable: Boolean(data?.unavailable),
    degraded: Boolean(data?.degraded),
    degradedReason: String(data?.degradedReason || ''),
    requestId,
    ...normalizedResponse,
  };
}

async function invokeMaxxisProfileAction(functionName, actionId) {
  const id = String(actionId || '').trim();
  if (!id) throw new Error('Maxxis Deal AI action ID is required.');
  if (!isSupabaseConfigured || !supabase) throw new Error('Maxxis Deal AI action service is unavailable.');
  const { data, error } = await supabase.functions.invoke(functionName, { body: { actionId: id } });
  if (error) {
    const actionError = new Error(String(data?.status || data?.error || 'MAXXIS_ACTION_FAILED'));
    actionError.code = String(data?.status || data?.error || 'MAXXIS_ACTION_FAILED');
    throw actionError;
  }
  if (data?.success !== true) {
    const actionError = new Error(String(data?.status || 'MAXXIS_ACTION_FAILED'));
    actionError.code = String(data?.status || 'MAXXIS_ACTION_FAILED');
    throw actionError;
  }
  return data;
}

export function confirmMaxxisProfileAction(actionId) {
  return invokeMaxxisProfileAction('maxxis-action-confirm', actionId);
}

export function cancelMaxxisProfileAction(actionId) {
  return invokeMaxxisProfileAction('maxxis-action-cancel', actionId);
}

async function invokeMaxxisProviderUnlock(functionName, body) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Maxxis Deal AI provider unlock service is unavailable.');
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error || data?.success === false) {
    const actionError = new Error(String(data?.status || data?.error || 'MAXXIS_PROVIDER_UNLOCK_FAILED'));
    actionError.code = String(data?.status || data?.error || 'MAXXIS_PROVIDER_UNLOCK_FAILED');
    actionError.contactAccess = data?.contactAccess || null;
    throw actionError;
  }
  return data;
}

export function prepareMaxxisProviderContactUnlock(serviceId) {
  return invokeMaxxisProviderUnlock('maxxis-provider-unlock-prepare', { serviceId });
}

export function confirmMaxxisProviderContactUnlock({ serviceId, intentToken }) {
  return invokeMaxxisProviderUnlock('maxxis-provider-unlock-confirm', { serviceId, intentToken });
}

export function cancelMaxxisProviderContactUnlock(intentToken) {
  return invokeMaxxisProviderUnlock('maxxis-provider-unlock-cancel', { intentToken });
}

export async function prepareMaxxisProviderMessageDraft({ serviceId, propertyId, language = currentLanguage() }) {
  const cleanServiceId = String(serviceId || '').trim();
  const cleanPropertyId = String(propertyId || '').trim();
  if (!UUID_PATTERN.test(cleanServiceId)) throw new Error('Valid provider service ID is required.');
  if (!UUID_PATTERN.test(cleanPropertyId)) throw new Error('Valid property context is required.');
  if (!isSupabaseConfigured || !supabase) throw new Error('Maxxis Deal AI provider message draft service is unavailable.');
  const { data, error } = await supabase.functions.invoke('maxxis-provider-message-draft', {
    body: { serviceId: cleanServiceId, propertyId: cleanPropertyId, language },
  });
  if (error || data?.success === false) {
    const actionError = new Error(String(data?.status || data?.error || 'MAXXIS_PROVIDER_MESSAGE_DRAFT_FAILED'));
    actionError.code = String(data?.status || data?.error || 'MAXXIS_PROVIDER_MESSAGE_DRAFT_FAILED');
    actionError.contactAccess = data?.contactAccess || null;
    throw actionError;
  }
  return data;
}

async function invokeMaxxisProviderMessage(functionName, body) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Maxxis Deal AI provider message service is unavailable.');
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error || data?.success === false) {
    const actionError = new Error(String(data?.status || data?.error || 'MAXXIS_PROVIDER_MESSAGE_FAILED'));
    actionError.code = String(data?.status || data?.error || 'MAXXIS_PROVIDER_MESSAGE_FAILED');
    actionError.data = data || null;
    throw actionError;
  }
  return data;
}

export function prepareMaxxisProviderMessageSend({ serviceId, propertyId, message, idempotencyKey }) {
  const cleanServiceId = String(serviceId || '').trim();
  const cleanPropertyId = String(propertyId || '').trim();
  const text = String(message || '').trim();
  if (!UUID_PATTERN.test(cleanServiceId)) throw new Error('Valid provider service ID is required.');
  if (!UUID_PATTERN.test(cleanPropertyId)) throw new Error('Valid property context is required.');
  if (!text) throw new Error('Message is required.');
  if (text.length > 1800) throw new Error('Message is too long.');
  return invokeMaxxisProviderMessage('maxxis-provider-message-prepare', {
    serviceId: cleanServiceId,
    propertyId: cleanPropertyId,
    message: text,
    idempotencyKey,
  });
}

export function confirmMaxxisProviderMessageSend(actionId) {
  const cleanActionId = String(actionId || '').trim();
  if (!UUID_PATTERN.test(cleanActionId)) throw new Error('Valid Maxxis Deal AI provider message action ID is required.');
  return invokeMaxxisProviderMessage('maxxis-provider-message-confirm', { actionId: cleanActionId });
}

export function cancelMaxxisProviderMessageSend(actionId) {
  const cleanActionId = String(actionId || '').trim();
  if (!UUID_PATTERN.test(cleanActionId)) throw new Error('Valid Maxxis Deal AI provider message action ID is required.');
  return invokeMaxxisProviderMessage('maxxis-provider-message-cancel', { actionId: cleanActionId });
}

export async function analyzeMaxxisProviderConversation({ serviceId, propertyId = '', question = '' }) {
  const cleanServiceId = String(serviceId || '').trim();
  const cleanPropertyId = String(propertyId || '').trim();
  if (!UUID_PATTERN.test(cleanServiceId)) throw new Error('Valid provider service ID is required.');
  if (cleanPropertyId && !UUID_PATTERN.test(cleanPropertyId)) throw new Error('Valid property context is required.');
  if (!isSupabaseConfigured || !supabase) throw new Error('Maxxis Deal AI provider conversation analysis is unavailable.');
  const { data, error } = await supabase.functions.invoke('maxxis-provider-conversation-analysis', {
    body: {
      serviceId: cleanServiceId,
      ...(cleanPropertyId ? { propertyId: cleanPropertyId } : {}),
      ...(String(question || '').trim() ? { question: String(question || '').trim().slice(0, 260) } : {}),
    },
  });
  if (error || data?.success === false) {
    const actionError = new Error(String(data?.status || data?.error || 'MAXXIS_PROVIDER_CONVERSATION_ANALYSIS_FAILED'));
    actionError.code = String(data?.status || data?.error || 'MAXXIS_PROVIDER_CONVERSATION_ANALYSIS_FAILED');
    actionError.data = data || null;
    throw actionError;
  }
  return data;
}

export async function setMaxxisDealWorkflowManualItem({ propertyId, code, status }) {
  const cleanPropertyId = String(propertyId || '').trim();
  const cleanCode = String(code || '').trim();
  const cleanStatus = String(status || '').trim();
  if (!UUID_PATTERN.test(cleanPropertyId)) throw new Error('Valid property context is required.');
  if (!['inspection_completed', 'survey_completed', 'rehab_quote_received'].includes(cleanCode)) {
    throw new Error('Manual workflow item is not allowed.');
  }
  if (!['pending', 'completed'].includes(cleanStatus)) throw new Error('Manual workflow status is not allowed.');
  if (!isSupabaseConfigured || !supabase) throw new Error('Maxxis Deal AI Deal Progress service is unavailable.');
  const { data, error } = await supabase.functions.invoke('maxxis-deal-workflow', {
    body: { propertyId: cleanPropertyId, code: cleanCode, status: cleanStatus },
  });
  if (error || data?.success !== true || !data?.workflow) {
    const workflowError = new Error(String(data?.error || 'MAXXIS_DEAL_WORKFLOW_FAILED'));
    workflowError.code = String(data?.error || 'MAXXIS_DEAL_WORKFLOW_FAILED');
    throw workflowError;
  }
  return data.workflow;
}
