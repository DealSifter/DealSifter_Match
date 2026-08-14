import { getLang } from '../i18n/translations';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { captureOperationalMetric } from '../lib/observability';

const MAX_HISTORY_ITEMS = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export async function sendMaxxisMessage({ message, history = [], page = 'dashboard', language = currentLanguage(), propertyId = '', propertyIds = [] }) {
  const text = String(message || '').trim();
  if (!text) throw new Error('Message is required.');
  if (!isSupabaseConfigured || !supabase) {
    return {
      answer: FALLBACK_MESSAGES[language] || FALLBACK_MESSAGES.en,
      unavailable: true,
    };
  }

  const trustedPropertyIds = Array.from(new Set(
    (Array.isArray(propertyIds) ? propertyIds : [])
      .map((id) => String(id || '').trim())
      .filter((id) => UUID_PATTERN.test(id)),
  )).slice(0, 20);
  const trustedPropertyId = String(propertyId || '').trim();
  const context = {
    ...(UUID_PATTERN.test(trustedPropertyId) ? { propertyId: trustedPropertyId } : {}),
    ...(trustedPropertyIds.length ? { propertyIds: trustedPropertyIds } : {}),
  };

  const startedAt = Date.now();
  let data;
  let error;
  try {
    ({ data, error } = await supabase.functions.invoke('maxxis-chat', {
      body: {
        message: text,
        history: normalizeHistory(history),
        page,
        language,
        ...(Object.keys(context).length ? { context } : {}),
      },
    }));
  } catch (invokeError) {
    captureOperationalMetric('maxxis.chat', {
      success: false,
      duration_ms: Date.now() - startedAt,
      error_category: 'PROVIDER',
      error_code: String(invokeError?.code || invokeError?.status || 'INVOKE_FAILED').slice(0, 64),
    });
    throw invokeError;
  }

  if (error) {
    const status = Number(error?.context?.status || error?.status || 0);
    captureOperationalMetric('maxxis.chat', {
      success: false,
      duration_ms: Date.now() - startedAt,
      error_category: status === 401 || status === 403 ? 'AUTH' : status === 429 ? 'QUOTA' : 'PROVIDER',
      error_code: String(status || error?.code || 'MAXXIS_REQUEST_FAILED').slice(0, 64),
      provider_status: status || undefined,
    });
    if (status === 503) {
      return {
        answer: CONFIG_MESSAGES[language] || CONFIG_MESSAGES.en,
        unavailable: true,
      };
    }
    throw error;
  }

  if (data?.error === 'MAXXIS_NOT_CONFIGURED') {
    captureOperationalMetric('maxxis.chat', {
      success: false,
      duration_ms: Date.now() - startedAt,
      error_category: 'PROVIDER',
      error_code: 'MAXXIS_NOT_CONFIGURED',
    });
    return {
      answer: CONFIG_MESSAGES[language] || CONFIG_MESSAGES.en,
      unavailable: true,
    };
  }

  captureOperationalMetric('maxxis.chat', {
    success: true,
    duration_ms: Date.now() - startedAt,
    response_type: String(data?.type || 'text').slice(0, 40),
  });

  return {
    answer: String(data?.message || data?.answer || '').trim() || (FALLBACK_MESSAGES[language] || FALLBACK_MESSAGES.en),
    unavailable: Boolean(data?.unavailable),
    type: ['properties', 'services', 'investment_profile', 'property_details', 'property_comparison', 'deal_copilot_overview'].includes(data?.type) ? data.type : 'text',
    data: data?.type === 'properties' && Array.isArray(data?.data?.properties)
      ? data.data
      : data?.type === 'services' && Array.isArray(data?.data?.services)
        ? data.data
      : data?.type === 'investment_profile' && data?.data && typeof data.data.complete === 'boolean'
          ? data.data
        : data?.type === 'property_details' && data?.data && Object.prototype.hasOwnProperty.call(data.data, 'property')
          ? data.data
        : data?.type === 'property_comparison' && data?.data && Array.isArray(data.data.properties)
          ? data.data
        : data?.type === 'deal_copilot_overview' && data?.data?.propertySummary
          ? data.data
          : null,
  };
}

async function invokeMaxxisProfileAction(functionName, actionId) {
  const id = String(actionId || '').trim();
  if (!id) throw new Error('Maxxis action ID is required.');
  if (!isSupabaseConfigured || !supabase) throw new Error('Maxxis action service is unavailable.');
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
  if (!isSupabaseConfigured || !supabase) throw new Error('Maxxis provider unlock service is unavailable.');
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
  if (!isSupabaseConfigured || !supabase) throw new Error('Maxxis provider message draft service is unavailable.');
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
  if (!isSupabaseConfigured || !supabase) throw new Error('Maxxis provider message service is unavailable.');
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
  if (!UUID_PATTERN.test(cleanActionId)) throw new Error('Valid Maxxis provider message action ID is required.');
  return invokeMaxxisProviderMessage('maxxis-provider-message-confirm', { actionId: cleanActionId });
}

export function cancelMaxxisProviderMessageSend(actionId) {
  const cleanActionId = String(actionId || '').trim();
  if (!UUID_PATTERN.test(cleanActionId)) throw new Error('Valid Maxxis provider message action ID is required.');
  return invokeMaxxisProviderMessage('maxxis-provider-message-cancel', { actionId: cleanActionId });
}

export async function analyzeMaxxisProviderConversation({ serviceId, propertyId = '', question = '' }) {
  const cleanServiceId = String(serviceId || '').trim();
  const cleanPropertyId = String(propertyId || '').trim();
  if (!UUID_PATTERN.test(cleanServiceId)) throw new Error('Valid provider service ID is required.');
  if (cleanPropertyId && !UUID_PATTERN.test(cleanPropertyId)) throw new Error('Valid property context is required.');
  if (!isSupabaseConfigured || !supabase) throw new Error('Maxxis provider conversation analysis is unavailable.');
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
  if (!isSupabaseConfigured || !supabase) throw new Error('Maxxis Deal Progress service is unavailable.');
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
