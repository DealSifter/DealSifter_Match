import { useCallback, useEffect, useState } from 'react';
import { NUGGET_PACKS } from '../data/mockData';
import { redirectToCheckout, redirectToSubscription } from '../lib/stripeClient';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { trackAppEvent } from '../lib/adminEventTracking';
import { recordTermsAcceptance, TERMS_CONSENT_VERSION } from '../services/consentService';

export const normalizeCheckoutIntent = (intent) => {
  if (!intent || typeof intent !== 'object') return null;
  const kind = String(intent.kind || '').trim().toLowerCase();

  if (kind === 'subscription') {
    const planId = String(intent.planId || '').trim().toLowerCase();
    if (!planId) return null;
    const billingCycle = String(intent.billingCycle || intent.billing_cycle || 'monthly').trim().toLowerCase() === 'annual'
      ? 'annual'
      : 'monthly';
    return {
      kind: 'subscription',
      planId,
      billingCycle,
      source: String(intent.source || 'pricing').trim().toLowerCase() || 'pricing',
    };
  }

  if (kind === 'nuggets') {
    const packId = String(intent.packId || '').trim().toLowerCase();
    if (!packId) return null;
    return {
      kind: 'nuggets',
      packId,
      source: String(intent.source || 'pricing').trim().toLowerCase() || 'pricing',
    };
  }

  return null;
};

export function useCheckoutFlow({
  addToast,
  refreshProfileHydration,
  setModal,
  setPage,
  setSettingsInitialTab,
  setSystemAccount,
  supabaseUserId,
}) {
  const [checkoutModalIntent, setCheckoutModalIntent] = useState(null);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [pendingCheckoutIntent, setPendingCheckoutIntent] = useState(() => {
    try {
      const raw = localStorage.getItem('ds_pending_checkout_intent');
      const parsed = raw ? JSON.parse(raw) : null;
      return normalizeCheckoutIntent(parsed);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (pendingCheckoutIntent) {
        localStorage.setItem('ds_pending_checkout_intent', JSON.stringify(pendingCheckoutIntent));
      } else {
        localStorage.removeItem('ds_pending_checkout_intent');
      }
    } catch {
      // Ignore persistence failures; checkout can still be restarted from Pricing.
    }
  }, [pendingCheckoutIntent]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    const settingsTab = String(params.get('settings') || '').trim().toLowerCase();
    if (!checkout && !settingsTab) return;

    window.history.replaceState({}, '', window.location.pathname);

    if (settingsTab === 'payments') {
      setSystemAccount((prev) => ({
        ...(prev || {}),
        paymentSetupComplete: true,
        paymentSetupCompletedAt: prev?.paymentSetupCompletedAt || Date.now(),
      }));
      setSettingsInitialTab('payments');
      setPage('settings');
    }

    if (checkout === 'success') {
      trackAppEvent('checkout_success', {
        entityType: pendingCheckoutIntent?.kind || 'checkout',
        entityId: pendingCheckoutIntent?.planId || pendingCheckoutIntent?.packId || '',
        metadata: { source: pendingCheckoutIntent?.source || 'return' },
      });
      setPendingCheckoutIntent(null);
      setCheckoutModalIntent(null);
      setCheckoutSubmitting(false);
      setCheckoutError('');
      if (isSupabaseConfigured && supabaseUserId) {
        refreshProfileHydration?.();
      }
      addToast?.({
        type: 'success',
        title: 'Pagamento confirmado!',
        message: 'Seus nuggets serao creditados em instantes via webhook.',
        duration: 7000,
      });
    } else if (checkout === 'cancelled') {
      trackAppEvent('checkout_cancelled', {
        entityType: pendingCheckoutIntent?.kind || 'checkout',
        entityId: pendingCheckoutIntent?.planId || pendingCheckoutIntent?.packId || '',
        metadata: { source: pendingCheckoutIntent?.source || 'return' },
      });
      setPendingCheckoutIntent(null);
      setCheckoutModalIntent(null);
      setCheckoutSubmitting(false);
      setCheckoutError('');
      setModal(null);
      setPage('pricing');
      addToast?.({
        type: 'info',
        title: 'Compra cancelada',
        message: 'O pagamento foi cancelado. Seus nuggets nao foram alterados.',
      });
    }
  }, [addToast, pendingCheckoutIntent, refreshProfileHydration, setModal, setPage, setSettingsInitialTab, setSystemAccount, supabaseUserId]);

  const openPricingHub = useCallback(() => {
    setModal(null);
    setPage('pricing');
  }, [setModal, setPage]);

  const executeCheckoutIntent = useCallback(async (intentInput, checkoutOptions = {}) => {
    const intent = normalizeCheckoutIntent(intentInput);
    if (!intent) return false;

    setCheckoutError('');
    try {
      trackAppEvent('checkout_stripe_opened', {
        entityType: intent.kind,
        entityId: intent.planId || intent.packId || '',
        metadata: { source: intent.source || 'pricing' },
      });
      if (intent.kind === 'subscription') {
        await redirectToSubscription(intent.planId, { ...checkoutOptions, billingCycle: intent.billingCycle });
      } else if (intent.kind === 'nuggets') {
        const pack = NUGGET_PACKS.find((item) => String(item.id) === String(intent.packId));
        if (!pack) {
          throw new Error('Pacote de nuggets invalido para checkout.');
        }
        await redirectToCheckout(pack, checkoutOptions);
      }
      setPendingCheckoutIntent(null);
      return true;
    } catch (error) {
      const message = String(error?.message || 'Nao foi possivel iniciar o checkout no Stripe.');
      setCheckoutError(message);
      addToast?.({
        type: 'error',
        title: 'Falha no checkout',
        message,
      });
      return false;
    }
  }, [addToast]);

  const handlePricingCheckoutSelection = useCallback(async (intentInput) => {
    const intent = normalizeCheckoutIntent(intentInput);
    if (!intent) {
      addToast?.({
        type: 'warning',
        title: 'Selecao invalida',
        message: 'Escolha um plano ou pacote valido para continuar.',
      });
      return;
    }

    setPendingCheckoutIntent(intent);
    trackAppEvent('checkout_pricing_clicked', {
      entityType: intent.kind,
      entityId: intent.planId || intent.packId || '',
      metadata: { source: intent.source || 'pricing' },
    });
    setCheckoutError('');
    setCheckoutSubmitting(false);
    setCheckoutModalIntent(intent);
  }, [addToast]);

  const handleContinuePendingCheckout = useCallback(async () => {
    if (!pendingCheckoutIntent) return;
    setCheckoutError('');
    setCheckoutSubmitting(false);
    setCheckoutModalIntent(pendingCheckoutIntent);
  }, [pendingCheckoutIntent]);

  const returnToPendingCheckoutFromLegal = useCallback(() => {
    const intent = normalizeCheckoutIntent(pendingCheckoutIntent);
    if (!intent) return false;
    setPage(intent.source === 'settings' ? 'settings' : 'pricing');
    setCheckoutError('');
    setCheckoutSubmitting(false);
    setCheckoutModalIntent(intent);
    return true;
  }, [pendingCheckoutIntent, setPage]);

  const closeCheckoutModal = useCallback(() => {
    setCheckoutSubmitting(false);
    setCheckoutModalIntent(null);
  }, []);

  const handleHostedCheckoutFallback = useCallback(async () => {
    if (checkoutSubmitting) return false;
    const intent = normalizeCheckoutIntent(checkoutModalIntent || pendingCheckoutIntent);
    if (!intent) {
      const message = 'Selecao de checkout perdida. Escolha o plano ou pacote novamente.';
      setCheckoutError(message);
      addToast?.({
        type: 'error',
        title: 'Falha no checkout',
        message,
      });
      return false;
    }

    setCheckoutError('');
    setCheckoutSubmitting(true);
    trackAppEvent('checkout_terms_accepted', {
      entityType: intent.kind,
      entityId: intent.planId || intent.packId || '',
      metadata: { source: intent.source || 'pricing' },
    });
    try {
      await recordTermsAcceptance(supabaseUserId, TERMS_CONSENT_VERSION);
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[Checkout] Failed to persist terms acceptance.', error);
    }
    const completed = await executeCheckoutIntent(intent, { termsAccepted: true });
    if (completed) {
      setCheckoutModalIntent(null);
    } else {
      setCheckoutSubmitting(false);
    }
    return completed;
  }, [addToast, checkoutModalIntent, checkoutSubmitting, executeCheckoutIntent, pendingCheckoutIntent, supabaseUserId]);

  const handleEmbeddedCheckoutComplete = useCallback(() => {
    setPendingCheckoutIntent(null);
    setCheckoutModalIntent(null);
    if (isSupabaseConfigured && supabaseUserId) {
      refreshProfileHydration?.();
    }
    addToast?.({
      type: 'success',
      title: 'Pagamento confirmado!',
      message: 'Seu pagamento foi confirmado pelo Stripe. Atualizaremos seu saldo/plano em instantes.',
      duration: 7000,
    });
  }, [addToast, refreshProfileHydration, supabaseUserId]);

  const openCheckoutTerms = useCallback(() => {
    setCheckoutSubmitting(false);
    setCheckoutModalIntent(null);
    setPage('terms');
  }, [setPage]);

  const openCheckoutPrivacy = useCallback(() => {
    setCheckoutSubmitting(false);
    setCheckoutModalIntent(null);
    setPage('privacy');
  }, [setPage]);

  return {
    checkoutError,
    checkoutModalIntent,
    checkoutSubmitting,
    pendingCheckoutIntent,
    closeCheckoutModal,
    handleContinuePendingCheckout,
    handleEmbeddedCheckoutComplete,
    handleHostedCheckoutFallback,
    handlePricingCheckoutSelection,
    openCheckoutPrivacy,
    openCheckoutTerms,
    openPricingHub,
    returnToPendingCheckoutFromLegal,
  };
}
