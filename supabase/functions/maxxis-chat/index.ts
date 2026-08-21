import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, geminiApiKey, geminiModels, supabaseAnonKey, supabaseUrl } from '../_shared/maxxis/config.ts';
import { callGemini } from '../_shared/maxxis/geminiClient.ts';
import { logMaxxisEvent } from '../_shared/maxxis/logger.ts';
import { buildSystemPrompt } from '../_shared/maxxis/prompts.ts';
import { prepareProfileSuggestions } from '../_shared/maxxis/prepareProfileSuggestions.ts';
import { executeMaxxisTool, MAXXIS_TOOLS } from '../_shared/maxxis/toolRegistry.ts';
import { normalizeComparisonContextIds } from '../_shared/maxxis/compareProperties.ts';
import type { MaxxisLanguage, MaxxisResponse } from '../_shared/maxxis/types.ts';
import { createRequestId, getEdgeRelease } from '../_shared/observability.ts';
import {
  checkRateLimit,
  isOperationalFeatureEnabled,
  logAbuseGuard,
  MAXXIS_EXECUTION_LIMITS,
  MaxxisExecutionBudget,
  rateLimitResponse,
  readJsonWithLimit,
} from '../_shared/abuseProtection.ts';

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing SUPABASE_ANON_KEY');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const E2E_LLM_STUB_PROJECT_REFS = new Set(['oqdcnjupquhybwdbeeew']);

function response(body: MaxxisResponse, status: number, origin: string, requestId = '') {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', ...(requestId ? { 'x-request-id': requestId } : {}) } });
}

function sanitizeText(value: unknown, maxLength = 2400) {
  return String(value || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function supabaseProjectRef() {
  try {
    return new URL(supabaseUrl).hostname.split('.')[0].toLowerCase();
  } catch {
    return '';
  }
}

function isE2ELlmStubEnabled() {
  return Deno.env.get('MAXXIS_E2E_LLM_STUB') === '1'
    && E2E_LLM_STUB_PROJECT_REFS.has(supabaseProjectRef());
}

function e2eStubFunctionCall(message: string, propertyContextId: string) {
  const normalized = ` ${message.toLowerCase()} `;
  if (normalized.includes('investment profile') || normalized.includes('perfil de investimento')) {
    return { name: 'getMyInvestmentProfile', args: {} };
  }
  if (propertyContextId && (normalized.includes('copilot') || normalized.includes('overall situation') || normalized.includes('deal status') || normalized.includes('deal summary'))) {
    return { name: 'getDealCopilotOverview', args: { propertyId: propertyContextId } };
  }
  if (propertyContextId && (normalized.includes('detail') || normalized.includes('property') || normalized.includes('deal') || normalized.includes('professionals') || normalized.includes('services'))) {
    return {
      name: 'getPropertyDetails',
      args: {
        propertyId: propertyContextId,
        includeServiceMatches: normalized.includes('professional') || normalized.includes('service') || normalized.includes('provider'),
        includeOperationalContext: normalized.includes('next') || normalized.includes('workflow') || normalized.includes('checklist'),
      },
    };
  }
  if (normalized.includes('contractor') || normalized.includes('provider') || normalized.includes('service')) {
    return { name: 'searchServices', args: { category: 'General Contractor', state: 'TX', city: 'Dallas', limit: 5 } };
  }
  if (normalized.includes('property') || normalized.includes('properties') || normalized.includes('dallas') || normalized.includes('texas')) {
    return { name: 'searchProperties', args: { state: ['TX'], city: 'Dallas', limit: 5 } };
  }
  return null;
}

function detectLanguage(text: string, preferred = 'auto'): MaxxisLanguage {
  const normalized = ` ${String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()} `;
  const pt = [' voce ', ' ajuda ', ' imovel ', ' negocio ', ' desbloquear ', ' preciso '].filter((word) => normalized.includes(word)).length;
  const es = [' usted ', ' puedes ', ' ayuda ', ' inmueble ', ' propiedad '].filter((word) => normalized.includes(word)).length;
  if (pt > es && pt) return 'pt';
  if (es > pt && es) return 'es';
  return ['en', 'pt', 'es'].includes(preferred.slice(0, 2)) ? preferred.slice(0, 2) as MaxxisLanguage : 'en';
}

function fallback(language: MaxxisLanguage, reason: 'quota' | 'provider' | 'config') {
  const messages = {
    config: { en: 'Maxxis AI still needs to be configured by support.', pt: 'O Maxxis AI ainda precisa ser configurado pelo suporte.', es: 'Maxxis AI todavia debe ser configurado por soporte.' },
    quota: { en: 'Maxxis AI is connected, but provider quota or billing is not active.', pt: 'O Maxxis AI esta conectado, mas a cota ou billing do provedor nao esta ativo.', es: 'Maxxis AI esta conectado, pero la cuota o facturacion del proveedor no esta activa.' },
    provider: { en: 'Maxxis AI had a temporary issue. Please try again shortly or contact human support.', pt: 'O Maxxis AI teve uma falha temporaria. Tente novamente ou acione o suporte humano.', es: 'Maxxis AI tuvo una falla temporal. Intentalo de nuevo o contacta soporte humano.' },
  };
  return messages[reason][language];
}

function propertySearchMessage(language: MaxxisLanguage, count: number, personalized = false, requiresProfile = false) {
  if (requiresProfile) return language === 'pt' ? 'Configure seu Investment Profile para calcular matches personalizados.' : language === 'es' ? 'Configura tu Investment Profile para calcular matches personalizados.' : 'Configure your Investment Profile to calculate personalized matches.';
  if (count === 0) return language === 'pt' ? 'Não encontrei propriedades ativas com esses critérios.' : language === 'es' ? 'No encontré propiedades activas con esos criterios.' : 'I could not find active properties matching those criteria.';
  if (personalized) return language === 'pt' ? `Encontrei ${count} oportunidade${count === 1 ? '' : 's'} ordenada${count === 1 ? '' : 's'} pela compatibilidade calculada com seu perfil.` : language === 'es' ? `Encontré ${count} oportunidad${count === 1 ? '' : 'es'} ordenada${count === 1 ? '' : 's'} por compatibilidad calculada con tu perfil.` : `I found ${count} opportunit${count === 1 ? 'y' : 'ies'} ranked by calculated compatibility with your profile.`;
  return language === 'pt' ? `Encontrei ${count} propriedade${count === 1 ? '' : 's'} ativa${count === 1 ? '' : 's'} com esses critérios.` : language === 'es' ? `Encontré ${count} propiedad${count === 1 ? '' : 'es'} activa${count === 1 ? '' : 's'} con esos criterios.` : `I found ${count} active propert${count === 1 ? 'y' : 'ies'} matching those criteria.`;
}

function serviceSearchMessage(language: MaxxisLanguage, count: number) {
  if (count === 0) return language === 'pt' ? 'Não encontrei profissionais publicados com esses critérios.' : language === 'es' ? 'No encontré profesionales publicados con esos criterios.' : 'I could not find published providers matching those criteria.';
  return language === 'pt' ? `Encontrei ${count} serviço${count === 1 ? '' : 's'} publicado${count === 1 ? '' : 's'} com esses critérios.` : language === 'es' ? `Encontré ${count} servicio${count === 1 ? '' : 's'} publicado${count === 1 ? '' : 's'} con esos criterios.` : `I found ${count} published service${count === 1 ? '' : 's'} matching those criteria.`;
}

function investmentProfileMessage(language: MaxxisLanguage, exists: boolean, complete: boolean) {
  if (!exists) return language === 'pt' ? 'Você ainda não configurou seu Investment Profile.' : language === 'es' ? 'Aún no configuraste tu Investment Profile.' : 'You have not configured your Investment Profile yet.';
  if (!complete) return language === 'pt' ? 'Este é o seu Investment Profile atual. Ele ainda está parcialmente preenchido.' : language === 'es' ? 'Este es tu Investment Profile actual. Aún está parcialmente completo.' : 'This is your current Investment Profile. It is still partially complete.';
  return language === 'pt' ? 'Este é o seu Investment Profile atual.' : language === 'es' ? 'Este es tu Investment Profile actual.' : 'This is your current Investment Profile.';
}

function propertyDetailsMessage(language: MaxxisLanguage, found: boolean) {
  if (!found) return language === 'pt'
    ? 'Esta propriedade não está disponível ou você não tem acesso aos dados publicados.'
    : language === 'es'
      ? 'Esta propiedad no está disponible o no tienes acceso a sus datos publicados.'
      : 'This property is unavailable or you do not have access to its published details.';
  return language === 'pt'
    ? 'Estes são os dados factuais publicados, as métricas determinísticas e a análise factual do Deal Advisor para esta propriedade.'
    : language === 'es'
      ? 'Estos son los datos factuales publicados, las métricas determinísticas y el análisis factual del Deal Advisor para esta propiedad.'
      : 'These are the factual published details, deterministic metrics, and factual Deal Advisor analysis for this property.';
}

function propertyComparisonMessage(language: MaxxisLanguage, available: boolean) {
  if (!available) return language === 'pt'
    ? 'Selecione ou pesquise pelo menos duas propriedades disponíveis para compará-las.'
    : language === 'es'
      ? 'Selecciona o busca al menos dos propiedades disponibles para compararlas.'
      : 'Select or search for at least two available properties to compare them.';
  return language === 'pt'
    ? 'Esta é a comparação objetiva dos dados publicados e das métricas disponíveis.'
    : language === 'es'
      ? 'Esta es la comparación objetiva de los datos publicados y las métricas disponibles.'
      : 'This is the objective comparison of the published data and available metrics.';
}

function dealCopilotMessage(language: MaxxisLanguage, available: boolean) {
  if (!available) return propertyDetailsMessage(language, false);
  return language === 'pt'
    ? 'Esta e a visao consolidada e operacional deste deal com base somente nos dados e estados existentes.'
    : language === 'es'
      ? 'Esta es la vista consolidada y operativa de este deal basada solamente en datos y estados existentes.'
      : 'This is the consolidated operational view of this deal based only on existing data and state.';
}

function propertyContextInstruction(propertyId: string, searchPropertyIds: string[], comparisonPropertyIds: string[]) {
  const detailsContext = propertyId
    ? `Trusted current property context: {"propertyId":"${propertyId}"}. For getPropertyDetails or getDealCopilotOverview, copy this exact UUID. For one metric or a focused property question, omit includeOperationalContext. Set includeOperationalContext true only for an explicit Next Best Action, what-to-do-next, checklist, or deal-progress request.`
    : 'No trusted current property context is available. Never call getPropertyDetails or getDealCopilotOverview; ask the user to open or select a specific property.';
  const comparisonContext = comparisonPropertyIds.length >= 2
    ? `Trusted comparison propertyIds are ${JSON.stringify(comparisonPropertyIds)}. Search-result IDs are in display order ${JSON.stringify(searchPropertyIds)}. For compareProperties, copy an exact subset of two or three IDs from this context.`
    : 'Fewer than two trusted comparison propertyIds are available. Never call compareProperties; ask the user to select or search for at least two properties.';
  return `${detailsContext} ${comparisonContext} Never substitute, infer, or invent a propertyId. Use getDealCopilotOverview only for an explicit overall deal status, summary, what happened, what remains, or current situation request. For one metric or a focused property question, use getPropertyDetails and do not load the overview. For an explicit request such as "show professionals for this property", "who can help with this deal", or "find the suggested services", call getPropertyDetails with includeServiceMatches true. Otherwise omit that flag. Never call searchServices separately to choose categories for a property; the backend derives them exclusively from serviceNeeds. If DealMetricsResult, DealAdvisorAnalysis, PropertyServiceNeed, PropertyServiceMatch, ServiceFitResult, ProviderContactAccess, ProviderMessageContext, Next Best Action, Deal Workflow, Deal Copilot Overview, provider_message_draft, provider_message_sent, provider_conversation_analysis, or a property comparison is supplied, explain only exact returned values, codes, reasons, and sources. Deal Copilot Overview only aggregates existing capability outputs. Gemini may route to it and explain it, but must never recalculate a score or metric, create advice, change workflow, create a Next Best Action, invent a provider or conversation, execute an action, consume Nuggets, or send a message. Next Best Action is a deterministic backend suggestion. Gemini must never choose, alter, reprioritize, invent, execute, or confirm it; create workflow, pipeline, checklist, deal, or negotiation statuses from it; consume Nuggets; send messages; or claim that its suggested step occurred. Gemini may only explain the returned code, priority, reason, actionable flag, confirmation requirement, target, and alternatives. Deal Workflow is deterministic backend state. Gemini must never define items, change status or source, complete items, fabricate evidence, interpret progress as deal quality or probability, create negotiation status, execute an action, send a message, consume Nuggets, or create reminders or deadlines. It may only explain the returned items and operational completed/total count. Service Fit is an objective backend compatibility calculation, not provider quality, reputation, endorsement, or a recommendation. Provider contact unlock is an entitlement flow controlled by backend RPCs and explicit UI confirmation. You may explain exact contactAccess status and cost returned by the backend, but you must never create an unlock intent, confirm an unlock, execute an RPC, consume Nuggets, reveal contact fields, invent a serviceId, or say contact is available before the backend confirms entitlement. Provider Message Draft is a backend/UI draft action for an already identified serviceId and propertyId; you must never choose the recipient, change the serviceId, send a message, create pending_message_send, negotiate price, promise hiring, make binding offers, or imply that the user has committed to payment or engagement. Confirmed Provider Message Send is executed only by backend/UI endpoints after explicit user confirmation and must use the user's final reviewed text; you must never send, confirm, modify text after confirmation, choose a recipient, call send endpoints, send follow-ups, initiate conversations automatically, or claim a message was sent unless the backend returns provider_message_sent. Provider Conversation Analysis is a read-only assistant view of already authorized chat_messages and may only summarize extracted facts, questions, requests, quoted amounts, availability, open items, and an editable suggested reply; you must never send the suggestedReply, auto-reply, choose or switch provider/conversation, alter past messages, create follow-up tasks, negotiate, update property data, update Service Fit, consume Nuggets, or infer contract, hiring, accepted price, accepted terms, or appointment confirmation unless the provider stated it explicitly. Never calculate, recalculate, estimate, modify, override, or invent a Service Fit score, classification, reason, or order. Never create, remove, or reclassify Deal Advisor signals, attention points, missing information, limitations, service needs, categories, or providers. Never add a service, remove a service, change service confidence, imply a service is mandatory, rank or choose a provider. Suggested services are contextual types that may be relevant, not legal or operational requirements. Never calculate comparison values or create missing numbers. Never choose a preferred property or describe any property as the best deal, winner, buy, or avoid. Match Score is unrelated and must not be used in financial comparison. Cap rate is user-reported stored data, not verified return. Never calculate, derive, estimate, verify, or judge any additional metric, including ROI, profit, MAO, ARV, rehab estimates, risk, deal quality, or recommendations.`;
}

async function authenticatedUser(authHeader: string) {
  const token = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await client.auth.getUser(token);
  return error || !user ? null : user;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') || '';
  const requestId = createRequestId(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method === 'GET' && new URL(req.url).searchParams.get('health') === '1') {
    logMaxxisEvent('health', { request_id: requestId, duration_ms: 0, success: true });
    return new Response(JSON.stringify({ status: 'ok', function: 'maxxis-chat', release: getEdgeRelease() }), {
      status: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'x-request-id': requestId, 'Cache-Control': 'no-store' },
    });
  }
  if (req.method !== 'POST') return response({ message: 'Method not allowed', type: 'text', data: null, actions: [], error: 'METHOD_NOT_ALLOWED' }, 405, origin);

  const startedAt = Date.now();
  let userId = '';
  let usedModel = '';
  let fallbackCount = 0;
  let providerDurationMs = 0;
  let requestPayloadBytes = 0;
  let systemPromptBytes = 0;
  let toolDeclarationBytes = 0;
  let historyCount = 0;
  const budget = new MaxxisExecutionBudget();
  try {
    const user = await authenticatedUser(req.headers.get('Authorization') || '');
    if (!user) {
      logMaxxisEvent('maxxis_chat', { request_id: requestId, duration_ms: Date.now() - startedAt, success: false, error_code: 'UNAUTHORIZED' });
      return response({ message: 'Authentication required.', type: 'text', data: null, actions: [], error: 'UNAUTHORIZED' }, 401, origin);
    }
    userId = user.id;
    if (!isOperationalFeatureEnabled('MAXXIS_ENABLED')) {
      logAbuseGuard({ functionName: 'maxxis-chat', operation: 'maxxis_disabled', requestId, userId, category: 'ABUSE_GUARD', status: 503 });
      return response({ message: 'Maxxis is temporarily unavailable.', type: 'text', data: null, actions: [], unavailable: true, error: 'MAXXIS_DISABLED' }, 503, origin, requestId);
    }
    const rateLimit = await checkRateLimit(userId, 'maxxis_chat');
    if (!rateLimit.allowed) {
      logAbuseGuard({ functionName: 'maxxis-chat', operation: 'maxxis_chat', requestId, userId, category: 'RATE_LIMIT', status: rateLimit.unavailable ? 503 : 429, limitType: 'maxxis_chat' });
      return rateLimitResponse(rateLimit, requestId, corsHeaders(origin));
    }
    const parsed = await readJsonWithLimit(req, MAXXIS_EXECUTION_LIMITS.maxRequestBytes);
    if (!parsed.ok) {
      const status = parsed.error === 'REQUEST_TOO_LARGE' ? 413 : 400;
      logAbuseGuard({ functionName: 'maxxis-chat', operation: 'maxxis_chat', requestId, userId, category: parsed.error === 'REQUEST_TOO_LARGE' ? 'REQUEST_TOO_LARGE' : 'ABUSE_GUARD', status, limitType: 'request_body' });
      return response({ message: 'Invalid request.', type: 'text', data: null, actions: [], error: parsed.error }, status, origin, requestId);
    }
    const body = parsed.body as Record<string, unknown>;
    const bodyContext = body.context && typeof body.context === 'object'
      ? body.context as Record<string, unknown>
      : {};
    requestPayloadBytes = new TextEncoder().encode(JSON.stringify(body)).byteLength;
    const rawMessage = String(body.message || '');
    if (rawMessage.length > MAXXIS_EXECUTION_LIMITS.maxMessageChars) {
      logAbuseGuard({ functionName: 'maxxis-chat', operation: 'maxxis_chat', requestId, userId, category: 'REQUEST_TOO_LARGE', status: 413, limitType: 'message' });
      return response({ message: 'Message is too large.', type: 'text', data: null, actions: [], error: 'REQUEST_TOO_LARGE' }, 413, origin, requestId);
    }
    const message = sanitizeText(rawMessage, MAXXIS_EXECUTION_LIMITS.maxMessageChars);
    const language = detectLanguage(message, sanitizeText(body.language || 'auto', 8));
    const rawPropertyContextId = sanitizeText(bodyContext.propertyId, 50);
    const propertyContextId = UUID_PATTERN.test(rawPropertyContextId) ? rawPropertyContextId : '';
    const searchPropertyIds = normalizeComparisonContextIds(bodyContext.propertyIds);
    const comparisonPropertyIds = normalizeComparisonContextIds([
      ...searchPropertyIds,
      ...(propertyContextId ? [propertyContextId] : []),
    ]);
    if (!message) return response({ message: 'Message is required.', type: 'text', data: null, actions: [], error: 'MESSAGE_REQUIRED' }, 400, origin);
    const stubFunctionCall = isE2ELlmStubEnabled() ? e2eStubFunctionCall(message, propertyContextId) : null;
    if (!geminiApiKey && !stubFunctionCall) {
      const text = fallback(language, 'config');
      return response({ message: text, answer: text, type: 'text', data: null, actions: [], language, unavailable: true, error: 'MAXXIS_NOT_CONFIGURED' }, 503, origin);
    }
    const history = Array.isArray(body.history) ? body.history : [];
    historyCount = history.length;
    budget.validateHistory(history);
    const contents = [...history.map((item: Record<string, unknown>) => ({ role: item?.role === 'assistant' ? 'model' : 'user', parts: [{ text: sanitizeText(item?.content || item?.text, 1600) }] })).filter((item) => item.parts[0].text), { role: 'user', parts: [{ text: message }] }];
    const systemPrompt = `${buildSystemPrompt(language, sanitizeText(body.page || 'unknown', 60))}\n\n${propertyContextInstruction(propertyContextId, searchPropertyIds, comparisonPropertyIds)}`;
    systemPromptBytes = new TextEncoder().encode(systemPrompt).byteLength;
    toolDeclarationBytes = new TextEncoder().encode(JSON.stringify(MAXXIS_TOOLS)).byteLength;
    const geminiRequest = { systemInstruction: { parts: [{ text: systemPrompt }] }, contents, tools: MAXXIS_TOOLS, generationConfig: { temperature: 0.45, topP: 0.9, maxOutputTokens: MAXXIS_EXECUTION_LIMITS.maxOutputTokens }, safetySettings: [{ category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' }, { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' }, { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' }, { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }] };
    const providerErrors: Array<{ status: number }> = [];
    let payload: Record<string, unknown> = {};
    if (stubFunctionCall) {
      usedModel = 'e2e-llm-stub';
    } else {
      for (const model of geminiModels) {
        budget.consumeGeminiCall();
        const providerStartedAt = Date.now();
        const result = await callGemini(model, geminiRequest, budget.remainingMs());
        providerDurationMs += Date.now() - providerStartedAt;
        payload = result.payload;
        if (result.response.ok) { usedModel = model; break; }
        fallbackCount += 1;
        providerErrors.push({ status: result.response.status });
      }
    }
    if (!usedModel) {
      const quota = providerErrors.some((item) => item.status === 429);
      const text = fallback(language, quota ? 'quota' : 'provider');
      logMaxxisEvent('maxxis_chat', { request_id: requestId, user_id: userId, duration_ms: Date.now() - startedAt, provider_duration_ms: providerDurationMs, success: false, fallback_count: fallbackCount, error_code: quota ? 'MAXXIS_PROVIDER_QUOTA' : 'MAXXIS_PROVIDER_FAILED' });
      return response({ message: text, answer: text, type: 'text', data: null, actions: [], language, unavailable: true, error: quota ? 'MAXXIS_PROVIDER_QUOTA' : 'MAXXIS_PROVIDER_FAILED' }, 502, origin);
    }
    const candidateList = Array.isArray(payload.candidates) ? payload.candidates : [];
    const firstCandidate = candidateList[0] && typeof candidateList[0] === 'object'
      ? candidateList[0] as Record<string, unknown>
      : {};
    const candidateContent = firstCandidate.content && typeof firstCandidate.content === 'object'
      ? firstCandidate.content as Record<string, unknown>
      : {};
    const parts = Array.isArray(candidateContent.parts)
      ? candidateContent.parts.filter((part): part is Record<string, unknown> => Boolean(part && typeof part === 'object'))
      : [];
    const functionCallPart = parts.find((part) => part.functionCall && typeof part.functionCall === 'object');
    const parsedFunctionCall = functionCallPart?.functionCall as Record<string, unknown> | undefined;
    const functionCall = stubFunctionCall || parsedFunctionCall;
    if (functionCall) {
      budget.consumeToolRound();
      const toolStartedAt = Date.now();
      const toolName = String(functionCall.name || '');
      let result;
      try {
        result = await executeMaxxisTool(
          toolName,
          functionCall.args && typeof functionCall.args === 'object' ? functionCall.args as Record<string, unknown> : {},
          req.headers.get('Authorization') || '',
          { propertyId: propertyContextId, propertyIds: comparisonPropertyIds, userId },
        );
      } catch (error) {
        if (toolName === 'getPropertyDetails' || toolName === 'getDealCopilotOverview') {
          logMaxxisEvent('maxxis_tool', { tool: toolName, duration_ms: Date.now() - toolStartedAt, success: false, property_found: false });
          const code = error instanceof Error ? error.message : '';
          if (code === 'PROPERTY_CONTEXT_REQUIRED' || code === 'PROPERTY_CONTEXT_MISMATCH' || code === 'INVALID_PROPERTY_ID' || code === 'INVALID_PROPERTY_DETAILS_INPUT') {
            const text = toolName === 'getDealCopilotOverview' ? dealCopilotMessage(language, false) : propertyDetailsMessage(language, false);
            return toolName === 'getDealCopilotOverview'
              ? response({ message: text, answer: text, type: 'deal_copilot_overview', data: null, actions: [], language }, 200, origin)
              : response({ message: text, answer: text, type: 'property_details', data: { property: null, missingFields: [], metrics: null, analysis: null, serviceNeeds: [], serviceMatches: null, nextBestAction: null, workflow: null }, actions: [], language }, 200, origin);
          }
        } else if (toolName === 'compareProperties') {
          const propertyCount = Array.isArray(functionCall.args?.propertyIds) ? Math.min(functionCall.args.propertyIds.length, 3) : 0;
          logMaxxisEvent('maxxis_compare_properties', { tool: toolName, duration_ms: Date.now() - toolStartedAt, success: false, property_count: propertyCount });
          const text = propertyComparisonMessage(language, false);
          return response({ message: text, answer: text, type: 'property_comparison', data: { properties: [], comparison: null }, actions: [], language }, 200, origin);
        } else {
          logMaxxisEvent('maxxis_tool', { request_id: requestId, user_id: userId, model: usedModel, duration_ms: Date.now() - toolStartedAt, success: false, fallback_count: fallbackCount, tool: toolName, error_code: error instanceof Error ? error.message : 'MAXXIS_TOOL_FAILED' });
        }
        throw error;
      }
      budget.validateToolPayload(result);
      const toolDurationMs = Date.now() - toolStartedAt;
      const dbDurationMs = Number(result?.performance?.dbDurationMs || result?.serviceMatchingSummary?.dbDurationMs || 0);
      const toolPayloadBytes = new TextEncoder().encode(JSON.stringify(result)).byteLength;
      const totalDurationMs = Date.now() - startedAt;
      logMaxxisEvent('maxxis_chat', {
        request_id: requestId,
        user_id: userId,
        model: usedModel,
        duration_ms: totalDurationMs,
        provider_duration_ms: providerDurationMs,
        tool_duration_ms: toolDurationMs,
        db_duration_ms: dbDurationMs,
        app_duration_ms: Math.max(0, totalDurationMs - providerDurationMs - toolDurationMs),
        request_payload_bytes: requestPayloadBytes,
        system_prompt_bytes: systemPromptBytes,
        tool_declaration_bytes: toolDeclarationBytes,
        tool_payload_bytes: toolPayloadBytes,
        history_count: historyCount,
        success: true,
        fallback_count: fallbackCount,
        tool: toolName,
        llm_call_count: budget.geminiCalls,
        tool_call_count: budget.toolCalls,
        tool_rounds: budget.toolRounds,
      });
      if (result.type === 'property_details') {
        logMaxxisEvent('maxxis_tool', { tool: toolName, duration_ms: Date.now() - toolStartedAt, success: true, property_found: result.found });
        if (result.serviceMatchingSummary) {
          logMaxxisEvent('maxxis_property_service_matching', {
            service_needs_processed: result.serviceMatchingSummary.serviceNeedsProcessed,
            searches_performed: result.serviceMatchingSummary.searchesPerformed,
            result_count: result.serviceMatchingSummary.resultsReturned,
            duration_ms: result.serviceMatchingSummary.durationMs,
            db_duration_ms: result.serviceMatchingSummary.dbDurationMs,
            query_count: result.serviceMatchingSummary.dbQueryCount,
            tool_payload_bytes: result.serviceMatchingSummary.payloadBytes,
            city_to_state_fallback: result.serviceMatchingSummary.cityToStateFallbackUsed,
          });
        }
        const text = propertyDetailsMessage(language, result.found);
        return response({ message: text, answer: text, type: 'property_details', data: { property: result.property, missingFields: result.missingFields, metrics: result.metrics, analysis: result.analysis, serviceNeeds: result.serviceNeeds, serviceMatches: result.serviceMatches, nextBestAction: result.nextBestAction || null, workflow: result.workflow || null }, actions: [], language }, 200, origin);
      }
      if (result.type === 'deal_copilot_overview') {
        const text = dealCopilotMessage(language, result.found);
        return response({ message: text, answer: text, type: 'deal_copilot_overview', data: result.overview || null, actions: [], language }, 200, origin);
      }
      if (result.type === 'property_comparison') {
        logMaxxisEvent('maxxis_compare_properties', { tool: toolName, duration_ms: Date.now() - toolStartedAt, success: true, property_count: result.properties.length });
        const text = propertyComparisonMessage(language, true);
        return response({ message: text, answer: text, type: 'property_comparison', data: { properties: result.properties, comparison: result.comparison }, actions: [], language }, 200, origin);
      }
      if (result.type === 'investment_profile') {
        logMaxxisEvent('maxxis_tool', { request_id: requestId, user_id: userId, model: usedModel, duration_ms: Date.now() - toolStartedAt, success: true, fallback_count: fallbackCount, tool: toolName, profile_exists: result.exists });
        const text = investmentProfileMessage(language, result.exists, result.complete);
        return response({ message: text, answer: text, type: 'investment_profile', data: { profile: result.profile, complete: result.complete }, actions: [], language }, 200, origin);
      }
      if (result.type === 'services') {
        const services = result.items;
        logMaxxisEvent('maxxis_tool', { request_id: requestId, user_id: userId, model: usedModel, duration_ms: Date.now() - toolStartedAt, success: true, fallback_count: fallbackCount, tool: toolName, result_count: services.length });
        const text = serviceSearchMessage(language, services.length);
        return response({ message: text, answer: text, type: 'services', data: { services }, actions: [], language }, 200, origin);
      }
      const properties = result.items;
      let profileSuggestions = result.profileSuggestions;
      if (profileSuggestions.length) {
        try {
          profileSuggestions = await prepareProfileSuggestions(profileSuggestions, req.headers.get('Authorization') || '');
          profileSuggestions.forEach((suggestion) => logMaxxisEvent('maxxis_action_created', {
            request_id: requestId,
            user_id: userId,
            duration_ms: Date.now() - toolStartedAt,
            success: true,
            operation: suggestion.operation,
            action_status: 'pending',
          }));
        } catch (error) {
          logMaxxisEvent('maxxis_action_created', {
            request_id: requestId,
            user_id: userId,
            duration_ms: Date.now() - toolStartedAt,
            success: false,
            error_code: error instanceof Error ? error.message : 'MAXXIS_ACTION_PREPARE_FAILED',
          });
        }
      }
      logMaxxisEvent('maxxis_tool', { request_id: requestId, user_id: userId, model: usedModel, duration_ms: Date.now() - toolStartedAt, success: true, fallback_count: fallbackCount, tool: toolName, result_count: properties.length, search_mode: result.personalized ? 'personalized' : 'explicit', evaluated_count: result.evaluatedProperties, scored_count: result.scoredProperties, ranking_duration_ms: result.rankingDurationMs, behavior_history_available: result.behaviorHistoryAvailable, behavior_action_count: result.behaviorActionCount, behavior_signal_applied: result.behaviorSignalApplied, behavior_duration_ms: result.behaviorDurationMs, profile_drift_detected: result.profileDriftDetected, profile_suggestion_count: result.profileSuggestions.length, profile_suggestion_dimensions: result.profileSuggestions.map((item) => item.dimension), profile_drift_duration_ms: result.profileDriftDurationMs });
      const text = propertySearchMessage(language, properties.length, result.personalized, result.requiresProfile);
      return response({ message: text, answer: text, type: 'properties', data: { properties, personalized: result.personalized, profileAvailable: result.profileAvailable, profileSuggestions }, actions: [], language }, 200, origin);
    }
    const text = String(parts.find((part) => part?.text)?.text || '').trim();
    if (!text) return response({ message: 'Maxxis could not generate a response. Please try again.', type: 'text', data: null, actions: [], error: 'MAXXIS_EMPTY_RESPONSE' }, 502, origin);
    logMaxxisEvent('maxxis_chat', { request_id: requestId, user_id: userId, model: usedModel, duration_ms: Date.now() - startedAt, provider_duration_ms: providerDurationMs, request_payload_bytes: requestPayloadBytes, system_prompt_bytes: systemPromptBytes, tool_declaration_bytes: toolDeclarationBytes, history_count: historyCount, success: true, fallback_count: fallbackCount, llm_call_count: budget.geminiCalls, tool_call_count: budget.toolCalls, tool_rounds: budget.toolRounds });
    return response({ message: text, answer: text, type: 'text', data: null, actions: [], language }, 200, origin);
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'AbortError';
    const errorCode = error instanceof Error ? error.message : 'MAXXIS_FAILED';
    const budgetExhausted = errorCode === 'MAXXIS_BUDGET_EXHAUSTED';
    const requestTooLarge = errorCode === 'MAXXIS_CONTEXT_TOO_LARGE' || errorCode === 'MAXXIS_TOOL_PAYLOAD_TOO_LARGE';
    if (budgetExhausted || requestTooLarge) {
      logAbuseGuard({ functionName: 'maxxis-chat', operation: 'maxxis_chat', requestId, userId, category: budgetExhausted ? 'BUDGET_EXHAUSTED' : 'REQUEST_TOO_LARGE', status: requestTooLarge ? 413 : 503, durationMs: Date.now() - startedAt, limitType: budgetExhausted ? 'execution_budget' : 'context' });
    }
    logMaxxisEvent('maxxis_chat', { request_id: requestId, user_id: userId, model: usedModel, duration_ms: Date.now() - startedAt, provider_duration_ms: providerDurationMs, request_payload_bytes: requestPayloadBytes, system_prompt_bytes: systemPromptBytes, tool_declaration_bytes: toolDeclarationBytes, history_count: historyCount, success: false, fallback_count: fallbackCount, error_code: timedOut ? 'MAXXIS_TIMEOUT' : errorCode, llm_call_count: budget.geminiCalls, tool_call_count: budget.toolCalls, tool_rounds: budget.toolRounds, timeout: timedOut, budget_exhausted: budgetExhausted });
    const text = fallback('en', 'provider');
    return response({ message: requestTooLarge ? 'Request context is too large.' : text, answer: requestTooLarge ? 'Request context is too large.' : text, type: 'text', data: null, actions: [], unavailable: true, error: timedOut ? 'MAXXIS_TIMEOUT' : errorCode }, requestTooLarge ? 413 : budgetExhausted ? 503 : 502, origin, requestId);
  }
});
