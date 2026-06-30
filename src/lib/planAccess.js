import { PLANS } from '../data/mockData';
import { getLang } from '../i18n/translations';

const DAY_MS = 24 * 60 * 60 * 1000;
const PLAN_USAGE_CACHE_KEY = 'ds_plan_usage_cache';

const FEATURE_COPY = {
  en: {
    chat: {
      title: 'Upgrade required for DealSifter Chat',
      message: 'Your Basic plan can view unlocked conversations, but sending messages is available on Professional and Enterprise plans.',
    },
    unlock: {
      title: 'Monthly unlock limit reached',
      message: 'Your Basic plan includes 3 unlocks per month. Upgrade to keep opening contacts and property opportunities.',
    },
    match: {
      title: 'Active match limit reached',
      message: 'Your current plan has reached its active match limit. Upgrade to continue matching without this restriction.',
    },
    swipe: {
      title: 'Daily swipe limit reached',
      message: 'Your Basic plan includes 20 feed swipes per day. Upgrade for unlimited browsing and faster deal discovery.',
    },
    like: {
      title: 'Daily favorite limit reached',
      message: 'Your Basic plan includes 5 favorited matches per day. Upgrade for unlimited favorites and matching.',
    },
    exportPdf: {
      title: 'PDF export requires Professional',
      message: 'Exporting unlocked properties as PDF is available on Professional and Enterprise plans.',
    },
    cta: 'View plans',
    dismiss: 'Not now',
  },
  pt: {
    chat: {
      title: 'Upgrade necessario para usar o Chat DealSifter',
      message: 'Seu plano Basico pode visualizar conversas desbloqueadas, mas o envio de mensagens esta disponivel nos planos Profissional e Empresarial.',
    },
    unlock: {
      title: 'Limite mensal de desbloqueios atingido',
      message: 'Seu plano Basico inclui 3 desbloqueios por mes. Faca upgrade para continuar abrindo contatos e oportunidades.',
    },
    match: {
      title: 'Limite de matches ativos atingido',
      message: 'Seu plano atual atingiu o limite de matches ativos. Faca upgrade para continuar dando match sem essa restricao.',
    },
    swipe: {
      title: 'Limite diario de swipes atingido',
      message: 'Seu plano Basico inclui 20 swipes no feed por dia. Faca upgrade para navegar sem limite e descobrir oportunidades mais rapido.',
    },
    like: {
      title: 'Limite diario de favoritos atingido',
      message: 'Seu plano Basico inclui 5 matches favoritados por dia. Faca upgrade para favoritos e matching ilimitados.',
    },
    exportPdf: {
      title: 'Exportar PDF exige plano Profissional',
      message: 'Exportar propriedades desbloqueadas em PDF esta disponivel nos planos Profissional e Empresarial.',
    },
    cta: 'Ver planos',
    dismiss: 'Agora nao',
  },
  es: {
    chat: {
      title: 'Se requiere upgrade para usar DealSifter Chat',
      message: 'Tu plan Basico puede ver conversaciones desbloqueadas, pero enviar mensajes esta disponible en los planes Profesional y Empresarial.',
    },
    unlock: {
      title: 'Limite mensual de desbloqueos alcanzado',
      message: 'Tu plan Basico incluye 3 desbloqueos por mes. Haz upgrade para seguir abriendo contactos y oportunidades.',
    },
    match: {
      title: 'Limite de matches activos alcanzado',
      message: 'Tu plan actual alcanzo el limite de matches activos. Haz upgrade para continuar sin esta restriccion.',
    },
    swipe: {
      title: 'Limite diario de swipes alcanzado',
      message: 'Tu plan Basico incluye 20 swipes en el feed por dia. Haz upgrade para navegar sin limite y descubrir oportunidades mas rapido.',
    },
    like: {
      title: 'Limite diario de favoritos alcanzado',
      message: 'Tu plan Basico incluye 5 matches favoritos por dia. Haz upgrade para favoritos y matching ilimitados.',
    },
    exportPdf: {
      title: 'Exportar PDF requiere Profesional',
      message: 'Exportar propiedades desbloqueadas como PDF esta disponible en los planes Profesional y Empresarial.',
    },
    cta: 'Ver planes',
    dismiss: 'Ahora no',
  },
};

function getLangBase() {
  return String(getLang?.() || 'en').toLowerCase().split('-')[0];
}

export function getPlanId(subscriptionOrPlan) {
  if (typeof subscriptionOrPlan === 'string') return subscriptionOrPlan.toLowerCase();
  return String(subscriptionOrPlan?.planId || subscriptionOrPlan?.id || 'free').toLowerCase();
}

export function getPlan(subscriptionOrPlan) {
  const planId = getPlanId(subscriptionOrPlan);
  return PLANS.find((plan) => plan.id === planId) || PLANS[0];
}

export function getPlanLimit(subscriptionOrPlan, key) {
  return getPlan(subscriptionOrPlan)?.limits?.[key];
}

export function isFeatureAllowed(subscriptionOrPlan, feature) {
  const planId = getPlanId(subscriptionOrPlan);
  const limits = getPlan(subscriptionOrPlan)?.limits || {};
  if (planId === 'admin' || planId === 'enterprise') return true;
  if (feature === 'chat') return Boolean(limits.hasDealSifterChat);
  if (feature === 'exportPdf') return Boolean(limits.canExportUnlockedPdf);
  return true;
}

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function safeReadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is best-effort; app should not crash if quota/private mode blocks it.
  }
}

export function readPlanUsage(scope) {
  // Cache only. Server/RPC remains the source of truth for all enforceable
  // limits; this exists only to keep UI counters responsive between refreshes.
  const cache = safeReadJson(PLAN_USAGE_CACHE_KEY, {});
  if (scope === 'month') return { unlocks: Number(cache?.unlocksThisMonth || 0) };
  return {
    swipes: Number(cache?.swipesToday || 0),
    likes: Number(cache?.likesToday || 0),
  };
}

export function incrementPlanUsage(scope, feature, amount = 1) {
  // Cache only. Do not use this to authorize paid/limited actions.
  const current = safeReadJson(PLAN_USAGE_CACHE_KEY, {});
  const fieldByFeature = {
    swipes: 'swipesToday',
    swipe: 'swipesToday',
    likes: 'likesToday',
    like: 'likesToday',
    unlocks: 'unlocksThisMonth',
    unlock: 'unlocksThisMonth',
  };
  const field = fieldByFeature[feature] || feature;
  const next = {
    ...current,
    [field]: Number(current?.[field] || 0) + amount,
    cachedAt: Date.now(),
    cacheOnly: true,
  };
  safeWriteJson(PLAN_USAGE_CACHE_KEY, next);
  return next[field];
}

export function pruneOldPlanUsage() {
  try {
    const cutoff = Date.now() - (62 * DAY_MS);
    Object.keys(localStorage).forEach((key) => {
      if (!key.startsWith('ds_plan_usage_')) return;
      const value = safeReadJson(key, null);
      if (value?.updatedAt && value.updatedAt < cutoff) localStorage.removeItem(key);
    });
    const cache = safeReadJson(PLAN_USAGE_CACHE_KEY, null);
    if (cache?.cachedAt && cache.cachedAt < cutoff) localStorage.removeItem(PLAN_USAGE_CACHE_KEY);
  } catch {
    // noop
  }
}

function normalizeUsageSnapshot(row = {}) {
  return {
    planId: getPlanId(row.plan_id || row.planId || 'free'),
    isAdmin: Boolean(row.is_admin ?? row.isAdmin),
    swipesToday: Number(row.swipes_today ?? row.swipesToday ?? 0),
    likesToday: Number(row.likes_today ?? row.likesToday ?? 0),
    unlocksThisMonth: Number(row.unlocks_this_month ?? row.unlocksThisMonth ?? 0),
    activeMatches: Number(row.active_matches ?? row.activeMatches ?? 0),
    updatedAt: Date.now(),
  };
}

export async function fetchPlanUsageSnapshot(supabaseClient) {
  if (!supabaseClient?.rpc) {
    return normalizeUsageSnapshot(safeReadJson(PLAN_USAGE_CACHE_KEY, {}));
  }
  const { data, error } = await supabaseClient.rpc('ds_get_plan_usage_snapshot');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const snapshot = normalizeUsageSnapshot(row || {});
  safeWriteJson(PLAN_USAGE_CACHE_KEY, snapshot);
  return snapshot;
}

export async function consumePlanActions(supabaseClient, actions = []) {
  const normalizedActions = [...new Set((actions || [])
    .map((action) => String(action || '').trim().toLowerCase())
    .filter(Boolean))];
  if (!normalizedActions.length) return { allowed: true, usages: safeReadJson(PLAN_USAGE_CACHE_KEY, {}) };
  if (!supabaseClient?.rpc) {
    return {
      allowed: false,
      failedAction: normalizedActions[0],
      feature: normalizedActions[0],
      reason: 'db_required',
      usages: safeReadJson(PLAN_USAGE_CACHE_KEY, {}),
    };
  }
  const { data, error } = await supabaseClient.rpc('ds_consume_plan_actions', { p_actions: normalizedActions });
  if (error) throw error;
  const result = data || {};
  const snapshot = normalizeUsageSnapshot(result.usages || result);
  safeWriteJson(PLAN_USAGE_CACHE_KEY, snapshot);
  return {
    allowed: Boolean(result.allowed),
    failedAction: result.failed_action || result.failedAction || null,
    feature: result.failed_action || result.failedAction || normalizedActions[0],
    reason: result.reason || null,
    used: Number(result.used ?? 0),
    limit: result.limit == null ? null : Number(result.limit),
    usages: snapshot,
  };
}

export async function consumePlanAction(supabaseClient, action) {
  return consumePlanActions(supabaseClient, [action]);
}

export function canUsePlanAction(subscriptionOrPlan, action, usage = {}) {
  const planId = getPlanId(subscriptionOrPlan);
  if (planId === 'admin') return { allowed: true, feature: action };
  const plan = getPlan(subscriptionOrPlan);
  const limits = plan?.limits || {};

  if (action === 'chat') {
    return { allowed: isFeatureAllowed(plan, 'chat'), feature: 'chat' };
  }

  if (action === 'exportPdf') {
    return { allowed: isFeatureAllowed(plan, 'exportPdf'), feature: 'exportPdf' };
  }

  if (action === 'like') {
    const limit = limits.likesPerDay;
    if (limit == null) return { allowed: true, feature: 'like' };
    const used = Number(usage.likesToday ?? 0);
    return { allowed: used < limit, feature: 'like', used, limit };
  }

  if (action === 'swipe') {
    const limit = limits.swipesPerDay;
    if (limit == null) return { allowed: true, feature: 'swipe' };
    const used = Number(usage.swipesToday ?? 0);
    return { allowed: used < limit, feature: 'swipe', used, limit };
  }

  if (action === 'match') {
    const limit = limits.activeMatches;
    if (limit == null) return { allowed: true, feature: 'match' };
    const used = Number(usage.activeMatches || 0);
    return { allowed: used < limit, feature: 'match', used, limit };
  }

  if (action === 'unlock') {
    const limit = limits.unlockRequestsPerMonth;
    if (limit == null) return { allowed: true, feature: 'unlock' };
    const used = Number(usage.unlocksThisMonth ?? 0);
    return { allowed: used < limit, feature: 'unlock', used, limit };
  }

  return { allowed: true, feature: action };
}

export function getPlanGateCopy(feature) {
  const lang = FEATURE_COPY[getLangBase()] ? getLangBase() : 'en';
  const pack = FEATURE_COPY[lang];
  return {
    ...(pack[feature] || pack.chat),
    cta: pack.cta,
    dismiss: pack.dismiss,
  };
}
