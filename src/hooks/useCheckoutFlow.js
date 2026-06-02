import { useCallback, useEffect, useState } from 'react';
import { NUGGET_PACKS } from '../data/mockData';
import { redirectToCheckout, redirectToSubscription } from '../lib/stripeClient';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export const normalizeCheckoutIntent = (intent) => {
  if (!intent || typeof intent !== 'object') return null;
  const kind = String(intent.kind || '').trim().toLowerCase();

  if (kind === 'subscription') {
    const planId = String(intent.planId || '').trim().toLowerCase();
    if (!planId) return null;
    return {
      kind: 'subscription',
      planId,
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
      setPendingCheckoutIntent(null);
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
      setPendingCheckoutIntent(null);
      addToast?.({
        type: 'info',
        title: 'Compra cancelada',
        message: 'O pagamento foi cancelado. Seus nuggets nao foram alterados.',
      });
    }
  }, [addToast, refreshProfileHydration, setPage, setSettingsInitialTab, setSystemAccount, supabaseUserId]);

  const openPricingHub = useCallback(() => {
    setModal(null);
    setPage('pricing');
  }, [setModal, setPage]);

  const executeCheckoutIntent = useCallback(async (intentInput, checkoutOptions = {}) => {
    const intent = normalizeCheckoutIntent(intentInput);
    if (!intent) return false;

    try {
      if (intent.kind === 'subscription') {
        await redirectToSubscription(intent.planId, checkoutOptions);
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
      addToast?.({
        type: 'error',
        title: 'Falha no checkout',
        message: String(error?.message || 'Nao foi possivel iniciar o checkout no Stripe.'),
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
    setCheckoutModalIntent(intent);
  }, [addToast]);

  const handleContinuePendingCheckout = useCallback(async () => {
    if (!pendingCheckoutIntent) return;
    setCheckoutModalIntent(pendingCheckoutIntent);
  }, [pendingCheckoutIntent]);

  const returnToPendingCheckoutFromLegal = useCallback(() => {
    const intent = normalizeCheckoutIntent(pendingCheckoutIntent);
    if (!intent) return false;
    setPage(intent.source === 'settings' ? 'settings' : 'pricing');
    setCheckoutModalIntent(intent);
    return true;
  }, [pendingCheckoutIntent, setPage]);

  const closeCheckoutModal = useCallback(() => {
    setCheckoutModalIntent(null);
  }, []);

  const handleHostedCheckoutFallback = useCallback(async () => {
    const intent = normalizeCheckoutIntent(checkoutModalIntent || pendingCheckoutIntent);
    if (!intent) return;
    setCheckoutModalIntent(null);
    await executeCheckoutIntent(intent, { termsAccepted: true });
  }, [checkoutModalIntent, executeCheckoutIntent, pendingCheckoutIntent]);

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
    setCheckoutModalIntent(null);
    setPage('terms');
  }, [setPage]);

  const openCheckoutPrivacy = useCallback(() => {
    setCheckoutModalIntent(null);
    setPage('privacy');
  }, [setPage]);

  return {
    checkoutModalIntent,
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
