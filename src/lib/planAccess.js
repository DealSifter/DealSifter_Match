import { PLANS } from '../data/mockData';
import { getLang } from '../i18n/translations';

const DAY_MS = 24 * 60 * 60 * 1000;

const FEATURE_COPY = {
  en: {
    chat: {
      title: 'Upgrade required for DealSifter Chat',
      message: 'Your Basic plan can view unlocked conversations, but sending messages is available on Professional and Enterprise plans.',
    },
    unlock: {
      title: 'Monthly unlock limit reached',
      message: 'Your Basic plan includes 3 unlock requests per month. Upgrade to keep opening contacts and property opportunities.',
    },
    match: {
      title: 'Active match limit reached',
      message: 'Your current plan has reached its active match limit. Upgrade to continue matching without this restriction.',
    },
    like: {
      title: 'Daily like limit reached',
      message: 'Your Basic plan includes 5 likes per day. Upgrade for unlimited likes and faster deal discovery.',
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
      message: 'Seu plano Basico inclui 3 solicitacoes de desbloqueio por mes. Faca upgrade para continuar abrindo contatos e oportunidades.',
    },
    match: {
      title: 'Limite de matches ativos atingido',
      message: 'Seu plano atual atingiu o limite de matches ativos. Faca upgrade para continuar dando match sem essa restricao.',
    },
    like: {
      title: 'Limite diario de curtidas atingido',
      message: 'Seu plano Basico inclui 5 curtidas por dia. Faca upgrade para curtidas ilimitadas e descoberta mais rapida de negocios.',
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
      message: 'Tu plan Basico incluye 3 solicitudes de desbloqueo por mes. Haz upgrade para seguir abriendo contactos y oportunidades.',
    },
    match: {
      title: 'Limite de matches activos alcanzado',
      message: 'Tu plan actual alcanzo el limite de matches activos. Haz upgrade para continuar sin esta restriccion.',
    },
    like: {
      title: 'Limite diario de likes alcanzado',
      message: 'Tu plan Basico incluye 5 likes por dia. Haz upgrade para likes ilimitados y descubrimiento mas rapido de negocios.',
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
  const limits = getPlan(subscriptionOrPlan)?.limits || {};
  if (feature === 'chat') return Boolean(limits.hasDealSifterChat);
  if (feature === 'exportPdf') return Boolean(limits.canExportUnlockedPdf || getPlanId(subscriptionOrPlan) === 'enterprise');
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
  const key = scope === 'month'
    ? `ds_plan_usage_month_${monthKey()}`
    : `ds_plan_usage_day_${dateKey()}`;
  return safeReadJson(key, {});
}

export function incrementPlanUsage(scope, feature, amount = 1) {
  const key = scope === 'month'
    ? `ds_plan_usage_month_${monthKey()}`
    : `ds_plan_usage_day_${dateKey()}`;
  const current = safeReadJson(key, {});
  const next = { ...current, [feature]: Number(current?.[feature] || 0) + amount, updatedAt: Date.now() };
  safeWriteJson(key, next);
  pruneOldPlanUsage();
  return next[feature];
}

export function pruneOldPlanUsage() {
  try {
    const cutoff = Date.now() - (62 * DAY_MS);
    Object.keys(localStorage).forEach((key) => {
      if (!key.startsWith('ds_plan_usage_')) return;
      const value = safeReadJson(key, null);
      if (value?.updatedAt && value.updatedAt < cutoff) localStorage.removeItem(key);
    });
  } catch {
    // noop
  }
}

export function canUsePlanAction(subscriptionOrPlan, action, usage = {}) {
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
    const used = Number(usage.likesToday || readPlanUsage('day')?.likes || 0);
    return { allowed: used < limit, feature: 'like', used, limit };
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
    const used = Number(usage.unlocksThisMonth || readPlanUsage('month')?.unlocks || 0);
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
