import { PLANS } from '../data/mockData';
import { getLang } from '../i18n/translations';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const PLAN_USAGE_CACHE_KEY = 'ds_plan_usage_cache';
const ADMIN_PLAN = {
  id: 'admin',
  planId: 'admin',
  name: 'Admin',
  planName: 'Admin',
  price: 0,
  limits: {
    swipesPerDay: null,
    likesPerDay: null,
    activeMatches: null,
    unlockRequestsPerMonth: null,
    canExportUnlockedPdf: true,
    hasDealSifterChat: true,
    featuredProfileDiscountPct: 100,
    exclusiveContactsIncluded: null,
    featuredProfileIncluded: true,
  },
};
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
    spotlight: {
      title: 'Spotlight requires available nuggets',
      message: 'Spotlight is activated only after the server confirms your nugget balance and debits the purchase.',
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
    spotlight: {
      title: 'Spotlight exige nuggets disponiveis',
      message: 'Spotlight so e ativado depois que o servidor confirma seu saldo e debita a compra.',
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
    spotlight: {
      title: 'Spotlight requiere nuggets disponibles',
      message: 'Spotlight solo se activa despues de que el servidor confirma tu saldo y descuenta la compra.',
    },
    exportPdf: {
      title: 'Exportar PDF requiere Profesional',
      message: 'Exportar propiedades desbloqueadas como PDF esta disponible en los planes Profesional y Empresarial.',
    },
    cta: 'Ver planes',
    dismiss: 'Ahora no',
  },
};

const normalizeAction = (action) => {
  const raw = String(action || '').trim().toLowerCase();
  if (raw === 'export_pdf' || raw === 'export-pdf' || raw === 'exportpdf') return 'exportPdf';
  if (raw === 'favorite') return 'like';
  if (raw === 'exclusive') return 'exclusivity';
  return raw;
};

const dbActionFor = (action) => {
  const normalized = normalizeAction(action);
  if (['swipe', 'unlock', 'match', 'like'].includes(normalized)) return normalized;
  return null;
};

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
    // Cache is best-effort only. Never use as source of truth.
  }
}

function getLangBase() {
  return String(getLang?.() || 'en').toLowerCase().split('-')[0];
}

export function getPlanId(subscriptionOrPlan) {
  if (typeof subscriptionOrPlan === 'string') return subscriptionOrPlan.toLowerCase();
  return String(subscriptionOrPlan?.planId || subscriptionOrPlan?.id || subscriptionOrPlan?.plan_id || 'free').toLowerCase();
}

export function getPlan(subscriptionOrPlan) {
  const planId = getPlanId(subscriptionOrPlan);
  if (planId === 'admin') return ADMIN_PLAN;
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
  if (feature === 'exportPdf' || feature === 'export_pdf') return Boolean(limits.canExportUnlockedPdf);
  if (feature === 'spotlight') return planId !== 'free';
  if (feature === 'exclusivity') return true;
  return true;
}

function normalizeUsageSnapshot(row = {}) {
  const isAdmin = Boolean(row.is_admin ?? row.isAdmin);
  return {
    planId: isAdmin ? 'admin' : getPlanId(row.plan_id || row.planId || 'free'),
    isAdmin,
    swipesToday: Number(row.swipes_today ?? row.swipesToday ?? 0),
    likesToday: Number(row.likes_today ?? row.likesToday ?? 0),
    unlocksThisMonth: Number(row.unlocks_this_month ?? row.unlocksThisMonth ?? 0),
    activeMatches: Number(row.active_matches ?? row.activeMatches ?? 0),
    updatedAt: Date.now(),
  };
}

function mapCurrentPlanPayload({ userRow = {}, subscriptionRow = {}, usage = {} } = {}) {
  const isAdmin = Boolean(userRow?.is_admin ?? userRow?.isAdmin ?? usage?.isAdmin ?? usage?.is_admin);
  const planId = isAdmin ? 'admin' : getPlanId(userRow?.plan_id || usage?.planId || subscriptionRow?.plan_id || 'free');
  const subscriptionPlanId = subscriptionRow?.plan_id ? getPlanId(subscriptionRow.plan_id) : '';
  const usesSubscriptionBilling = Boolean(!isAdmin && subscriptionPlanId && subscriptionPlanId === planId && !userRow?.plan_override_source);
  const plan = getPlan(planId);
  const limits = plan?.limits || {};
  const payload = {
    plan: {
      id: planId,
      planId,
      name: isAdmin ? 'Admin' : (usesSubscriptionBilling ? (subscriptionRow?.plan_name || plan?.name || planId) : (plan?.name || planId)),
      planName: isAdmin ? 'Admin' : (usesSubscriptionBilling ? (subscriptionRow?.plan_name || plan?.name || planId) : (plan?.name || planId)),
      status: isAdmin ? 'admin' : (userRow?.plan_override_source ? 'admin_granted' : (subscriptionRow?.status || 'active')),
      price: usesSubscriptionBilling ? Number(subscriptionRow?.price_cents || 0) / 100 : 0,
      nextBillingAt: usesSubscriptionBilling ? (subscriptionRow?.current_period_end || null) : null,
      source: isAdmin ? 'admin_account' : (userRow?.plan_override_source || (usesSubscriptionBilling ? 'stripe' : 'user_plan')),
      isAdmin,
      overrideReason: userRow?.plan_override_reason || null,
      overrideExpiresAt: userRow?.plan_override_expires_at || null,
    },
    nuggets: Number(userRow?.nuggets ?? 0),
    limits,
    usage,
  };
  return payload;
}

export async function refreshUsageFromDB(userId) {
  if (!userId || !isSupabaseConfigured || !supabase) {
    throw new Error('Supabase session required to refresh plan usage.');
  }
  const { data, error } = await supabase.rpc('ds_get_plan_usage_snapshot');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const snapshot = normalizeUsageSnapshot(row || {});
  safeWriteJson(PLAN_USAGE_CACHE_KEY, snapshot);
  return snapshot;
}

export async function getCurrentPlan(userId) {
  if (!userId || !isSupabaseConfigured || !supabase) {
    throw new Error('Supabase session required to read the current plan.');
  }
  const [userResult, subscriptionResult, usage] = await Promise.all([
    supabase
      .from('users')
      .select('nuggets, plan_id, is_admin, plan_override_source, plan_override_reason, plan_override_expires_at')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('subscriptions')
      .select('plan_id, plan_name, price_cents, status, current_period_end')
      .eq('user_id', userId)
      .maybeSingle(),
    refreshUsageFromDB(userId),
  ]);
  if (userResult.error) throw userResult.error;
  if (subscriptionResult.error) throw subscriptionResult.error;
  return mapCurrentPlanPayload({
    userRow: userResult.data || {},
    subscriptionRow: subscriptionResult.data || {},
    usage,
  });
}

export async function canPerformAction(userId, action) {
  const normalizedAction = normalizeAction(action);
  if (!userId || !isSupabaseConfigured || !supabase) {
    return { allowed: false, reason: 'db_required', remaining: 0, action: normalizedAction };
  }

  const current = await getCurrentPlan(userId);
  const dbAction = dbActionFor(normalizedAction);
  if (dbAction) {
    const gate = canUsePlanAction(current.plan, dbAction, current.usage);
    const remaining = gate.limit == null
      ? null
      : Math.max(0, Number(gate.limit || 0) - Number(gate.used || 0));
    return {
      allowed: Boolean(gate.allowed),
      reason: gate.allowed ? null : 'plan_limit_reached',
      remaining,
      action: gate.feature || dbAction,
      usages: current.usage,
    };
  }

  const allowed = isFeatureAllowed(current.plan, normalizedAction);
  return {
    allowed,
    reason: allowed ? null : 'feature_not_in_plan',
    remaining: allowed ? null : 0,
    action: normalizedAction,
    usages: current.usage,
  };
}

export async function getPlanActionAccess(userId, actions = ['swipe', 'unlock', 'spotlight', 'export_pdf', 'chat', 'exclusivity']) {
  if (!userId || !isSupabaseConfigured || !supabase) {
    const entries = (actions || []).map((action) => {
      const normalizedAction = normalizeAction(action);
      return [action, { allowed: false, reason: 'db_required', remaining: 0, action: normalizedAction }];
    });
    const access = Object.fromEntries(entries);
    if (access.export_pdf && !access.exportPdf) access.exportPdf = access.export_pdf;
    return access;
  }

  const current = await getCurrentPlan(userId);
  const entries = (actions || []).map((action) => {
    const normalizedAction = normalizeAction(action);
    const dbAction = dbActionFor(normalizedAction);
    if (dbAction) {
      const gate = canUsePlanAction(current.plan, dbAction, current.usage);
      const remaining = gate.limit == null
        ? null
        : Math.max(0, Number(gate.limit || 0) - Number(gate.used || 0));
      return [action, {
        allowed: Boolean(gate.allowed),
        reason: gate.allowed ? null : 'plan_limit_reached',
        remaining,
        action: gate.feature || dbAction,
        usages: current.usage,
      }];
    }
    const allowed = isFeatureAllowed(current.plan, normalizedAction);
    return [action, {
      allowed,
      reason: allowed ? null : 'feature_not_in_plan',
      remaining: allowed ? null : 0,
      action: normalizedAction,
      usages: current.usage,
    }];
  });
  const access = Object.fromEntries(entries);
  if (access.export_pdf && !access.exportPdf) access.exportPdf = access.export_pdf;
  return access;
}

export async function deductNuggets(userId, amount, reason = 'manual') {
  if (!userId || !isSupabaseConfigured || !supabase) {
    throw new Error('Supabase session required to deduct nuggets.');
  }
  const value = Math.max(0, Number(amount || 0));
  const { data, error } = await supabase.rpc('ds_deduct_nuggets', {
    p_amount: value,
    p_reason: String(reason || 'manual'),
  });
  if (error) throw error;
  const newBalance = Number(data?.newBalance ?? data?.new_balance ?? 0);
  return { newBalance };
}

export async function fetchPlanUsageSnapshot(supabaseClient = supabase) {
  if (!supabaseClient?.rpc) {
    throw new Error('Supabase RPC client required to read plan usage.');
  }
  const { data, error } = await supabaseClient.rpc('ds_get_plan_usage_snapshot');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const snapshot = normalizeUsageSnapshot(row || {});
  safeWriteJson(PLAN_USAGE_CACHE_KEY, snapshot);
  return snapshot;
}

export async function consumePlanActions(supabaseClient = supabase, actions = []) {
  const normalizedActions = [...new Set((actions || [])
    .map(dbActionFor)
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

export async function consumePlanAction(supabaseClient = supabase, action) {
  return consumePlanActions(supabaseClient, [action]);
}

export function readPlanUsage() {
  return safeReadJson(PLAN_USAGE_CACHE_KEY, {});
}

export function incrementPlanUsage() {
  throw new Error('Plan usage must be incremented by Supabase RPC confirmation only.');
}

export function pruneOldPlanUsage() {
  const cache = safeReadJson(PLAN_USAGE_CACHE_KEY, null);
  if (cache?.updatedAt && Date.now() - Number(cache.updatedAt) > 62 * 24 * 60 * 60 * 1000) {
    try { localStorage.removeItem(PLAN_USAGE_CACHE_KEY); } catch { /* no-op */ }
  }
}

export function canUsePlanAction(subscriptionOrPlan, action, usage = {}) {
  const normalizedAction = normalizeAction(action);
  const planId = getPlanId(subscriptionOrPlan);
  if (planId === 'admin') return { allowed: true, feature: normalizedAction };
  const plan = getPlan(subscriptionOrPlan);
  const limits = plan?.limits || {};

  if (normalizedAction === 'chat' || normalizedAction === 'exportPdf' || normalizedAction === 'spotlight' || normalizedAction === 'exclusivity') {
    return { allowed: isFeatureAllowed(plan, normalizedAction), feature: normalizedAction };
  }

  if (normalizedAction === 'like') {
    const limit = limits.likesPerDay;
    if (limit == null) return { allowed: true, feature: 'like' };
    const used = Number(usage.likesToday ?? 0);
    return { allowed: used < limit, feature: 'like', used, limit };
  }

  if (normalizedAction === 'swipe') {
    const limit = limits.swipesPerDay;
    if (limit == null) return { allowed: true, feature: 'swipe' };
    const used = Number(usage.swipesToday ?? 0);
    return { allowed: used < limit, feature: 'swipe', used, limit };
  }

  if (normalizedAction === 'match') {
    const limit = limits.activeMatches;
    if (limit == null) return { allowed: true, feature: 'match' };
    const used = Number(usage.activeMatches || 0);
    return { allowed: used < limit, feature: 'match', used, limit };
  }

  if (normalizedAction === 'unlock') {
    const limit = limits.unlockRequestsPerMonth;
    if (limit == null) return { allowed: true, feature: 'unlock' };
    const used = Number(usage.unlocksThisMonth ?? 0);
    return { allowed: used < limit, feature: 'unlock', used, limit };
  }

  return { allowed: true, feature: normalizedAction };
}

export function getPlanGateCopy(feature) {
  const lang = FEATURE_COPY[getLangBase()] ? getLangBase() : 'en';
  const pack = FEATURE_COPY[lang];
  const key = normalizeAction(feature);
  return {
    ...(pack[key] || pack.chat),
    cta: pack.cta,
    dismiss: pack.dismiss,
  };
}

export function isPlanLimitError(error) {
  if (error?.name === 'PlanLimitReached' || error?.code === 'plan_limit_reached') return true;
  const message = String(error?.message || error?.details || error?.detail || '').toLowerCase();
  return message.includes('plan_limit_reached');
}

export function resolveRemainingNuggets({ currentNuggets, serverRemainingNuggets, fallbackCost }) {
  const remote = Number(serverRemainingNuggets);
  if (Number.isFinite(remote)) return remote;
  return Math.max(0, Number(currentNuggets || 0) - Number(fallbackCost || 0));
}
