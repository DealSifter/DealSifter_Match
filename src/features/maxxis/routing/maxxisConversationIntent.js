import { parseAnalysisGapAnswer } from '../intelligence/analysisGapAnswer';

export const MAXXIS_CONVERSATION_INTENTS = Object.freeze({
  GAP_RESPONSE: 'GAP_RESPONSE',
  PROPERTY_ANALYSIS_QUESTION: 'PROPERTY_ANALYSIS_QUESTION',
  REPORT_REQUEST: 'REPORT_REQUEST',
  GENERAL_REAL_ESTATE_QUESTION: 'GENERAL_REAL_ESTATE_QUESTION',
  APP_HELP: 'APP_HELP',
  CURRENT_DEAL_FOLLOWUP: 'CURRENT_DEAL_FOLLOWUP',
  GENERAL_CONVERSATION: 'GENERAL_CONVERSATION',
});

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9$%]+/g, ' ')
  .trim();

const has = (text, pattern) => pattern.test(text);

const REPORT_RE = /\b(relatorio|report|pdf|exportar|exporte|gerar relatorio|gere o relatorio|formalizar analise)\b/;
const CURRENT_DEAL_RE = /\b(sub ?to|subject ?to|mortgage|hipoteca|financiamento existente|saldo devedor|saldo atual|parcela existente|custo de entrada|cash to seller|arrears|atrasados|reinstatement|reinstalacao|closing costs?|custos? de fechamento|divida assumida)\b/;
const PROPERTY_ANALYSIS_RE = /\b(arv|avm|valuation|avaliacao|estimativa de mercado|valor de mercado|comparaveis?|comps?|preco por sqft|price per sqft|perfil|aderencia|risco do imovel|condicao alvo|rehab)\b/;
const GENERAL_REAL_ESTATE_RE = /\b(tax deed|tax lien|wholesale|foreclosure|leilao fiscal|mercado imobiliario|real estate)\b/;
const APP_HELP_RE = /\b(como usar|como funciona o app|onde encontro|onde fica|botao|tela|feed|mapview|matches|nuggets?|plano|assinatura|dealsifter)\b/;
const CONTINUATION_RE = /\b(o que falta|what is missing|what s missing|que falta|e agora|what next|continue|continuar)\b/;

export function classifyMaxxisConversationIntent(message, options = {}) {
  const text = normalize(message);
  const requestedReportType = String(options.requestedReportType || '').trim();
  if (requestedReportType || has(text, REPORT_RE)) {
    return Object.freeze({ code: MAXXIS_CONVERSATION_INTENTS.REPORT_REQUEST, gapAnswer: null });
  }

  const gapAnswer = options.pendingGap ? parseAnalysisGapAnswer(options.pendingGap, message) : null;
  if (gapAnswer) {
    return Object.freeze({ code: MAXXIS_CONVERSATION_INTENTS.GAP_RESPONSE, gapAnswer });
  }

  if (has(text, CONTINUATION_RE) && [
    MAXXIS_CONVERSATION_INTENTS.CURRENT_DEAL_FOLLOWUP,
    MAXXIS_CONVERSATION_INTENTS.PROPERTY_ANALYSIS_QUESTION,
  ].includes(options.previousIntent)) {
    return Object.freeze({ code: options.previousIntent, gapAnswer: null });
  }

  if (has(text, CURRENT_DEAL_RE)) {
    return Object.freeze({ code: MAXXIS_CONVERSATION_INTENTS.CURRENT_DEAL_FOLLOWUP, gapAnswer: null });
  }
  if (has(text, PROPERTY_ANALYSIS_RE)) {
    return Object.freeze({ code: MAXXIS_CONVERSATION_INTENTS.PROPERTY_ANALYSIS_QUESTION, gapAnswer: null });
  }
  if (has(text, GENERAL_REAL_ESTATE_RE)) {
    return Object.freeze({ code: MAXXIS_CONVERSATION_INTENTS.GENERAL_REAL_ESTATE_QUESTION, gapAnswer: null });
  }
  if (has(text, APP_HELP_RE)) {
    return Object.freeze({ code: MAXXIS_CONVERSATION_INTENTS.APP_HELP, gapAnswer: null });
  }
  return Object.freeze({ code: MAXXIS_CONVERSATION_INTENTS.GENERAL_CONVERSATION, gapAnswer: null });
}

export function controlledIntentForConversation(route, explicitIntent = '') {
  if (String(explicitIntent || '').trim()) return String(explicitIntent).trim();
  if (route?.code === MAXXIS_CONVERSATION_INTENTS.CURRENT_DEAL_FOLLOWUP) return 'current_deal_followup';
  if (route?.code === MAXXIS_CONVERSATION_INTENTS.PROPERTY_ANALYSIS_QUESTION) return 'property_analysis_question';
  if (route?.code === MAXXIS_CONVERSATION_INTENTS.GENERAL_REAL_ESTATE_QUESTION) return 'general_real_estate_question';
  if (route?.code === MAXXIS_CONVERSATION_INTENTS.APP_HELP) return 'app_help';
  return '';
}

export function shouldPresentAnalysisGap(route, requestedReportType = '') {
  return Boolean(requestedReportType) || route?.code === MAXXIS_CONVERSATION_INTENTS.GAP_RESPONSE;
}
