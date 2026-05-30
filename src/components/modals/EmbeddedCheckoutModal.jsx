import React, { useCallback, useState } from 'react';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { C } from '../../theme/colors';
import { useT } from '../../i18n/translations';
import { NUGGET_PACKS, PLANS } from '../../data/mockData';
import {
  STRIPE_PUBLISHABLE_KEY,
  createEmbeddedCheckoutSessionForPack,
  createEmbeddedCheckoutSessionForPlan,
} from '../../lib/stripeClient';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';

const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

function resolveCheckoutSummary(intent, t) {
  if (intent?.kind === 'subscription') {
    const plan = PLANS.find((item) => String(item.id) === String(intent.planId));
    const name = t.planNames?.[intent.planId] || plan?.name || String(intent.planId || '').toUpperCase();
    return {
      title: name,
      subtitle: t.checkoutSubscription || 'Subscription plan',
      price: plan ? `$${Number(plan.price || 0).toLocaleString('en-US')}/mo` : '',
      accent: C.accent,
    };
  }

  const pack = NUGGET_PACKS.find((item) => String(item.id) === String(intent?.packId));
  const qty = Number(pack?.qty || 0) + Number(pack?.bonus || 0);
  return {
    title: pack ? `${qty} ${t.nuggetsWord || 'nuggets'}` : t.checkoutNuggets || 'Nugget pack',
    subtitle: t.checkoutNuggets || 'Nugget pack',
    price: pack ? `$${Number(pack.price || 0).toLocaleString('en-US')}` : '',
    accent: C.gold,
  };
}

export function EmbeddedCheckoutModal({
  intent,
  onClose,
  onHostedFallback,
  onComplete,
  onOpenTerms,
  onOpenPrivacy,
}) {
  const allT = useT();
  const t = allT.modals || {};
  const pricingT = allT.pricing || {};
  const [accepted, setAccepted] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [isPreparingCheckout, setIsPreparingCheckout] = useState(false);
  const summary = resolveCheckoutSummary(intent, pricingT);

  const fetchClientSecret = useCallback(async () => {
    try {
      setSessionError('');
      setIsPreparingCheckout(true);
      if (intent?.kind === 'subscription') {
        return await createEmbeddedCheckoutSessionForPlan(intent.planId);
      }
      const pack = NUGGET_PACKS.find((item) => String(item.id) === String(intent?.packId));
      return await createEmbeddedCheckoutSessionForPack(pack);
    } catch (error) {
      const message = String(error?.message || 'Unable to start embedded checkout.');
      setSessionError(message);
      throw error;
    } finally {
      setIsPreparingCheckout(false);
    }
  }, [intent, setIsPreparingCheckout, setSessionError]);

  const canRenderEmbedded = Boolean(stripePromise && accepted && !sessionError);
  const checkoutKey = `${intent?.kind || 'unknown'}-${intent?.planId || intent?.packId || 'item'}-${accepted ? 'accepted' : 'pending'}`;

  return (
    <Modal
      onClose={onClose}
      maxWidth={920}
      ariaLabel={t.checkoutTitle || 'Secure checkout'}
      contentStyle={{ padding: 0, overflow: 'hidden' }}
    >
      <style>{`
        .ds-checkout-modal-shell {
          display: grid;
          grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
          min-height: min(78dvh, 720px);
        }
        .ds-checkout-modal-side {
          padding: 28px;
          background:
            radial-gradient(circle at 18% 12%, ${C.alpha(C.accent, 0.2)}, transparent 32%),
            linear-gradient(160deg, ${C.alpha(C.card, 0.95)}, ${C.alpha(C.accent, 0.08)});
          border-right: 1px solid ${C.border};
        }
        .ds-checkout-modal-main {
          padding: 28px;
          display: grid;
          align-content: start;
          gap: 16px;
          min-width: 0;
        }
        .ds-checkout-embedded-frame {
          min-height: 480px;
          border: 1px solid ${C.border};
          border-radius: 16px;
          overflow: hidden;
          background: #fff;
        }
        @media (max-width: 760px) {
          .ds-checkout-modal-shell { grid-template-columns: 1fr; max-height: 86dvh; overflow-y: auto; }
          .ds-checkout-modal-side { border-right: 0; border-bottom: 1px solid ${C.border}; padding: 22px; }
          .ds-checkout-modal-main { padding: 22px; }
          .ds-checkout-embedded-frame { min-height: 560px; }
        }
      `}</style>

      <div className="ds-checkout-modal-shell">
        <aside className="ds-checkout-modal-side">
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: C.accent, fontWeight: 900, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              <Icon name="shield" size={16} color={C.accent} />
              {t.checkoutSecureBadge || 'Secure Stripe Checkout'}
            </div>
            <div>
              <h2 style={{ margin: '0 0 8px', color: C.t1, fontSize: 'clamp(24px, 4vw, 34px)', lineHeight: 1, letterSpacing: '-.04em' }}>
                {t.checkoutTitle || 'Secure checkout'}
              </h2>
              <p style={{ margin: 0, color: C.t2, fontSize: 13, lineHeight: 1.55 }}>
                {t.checkoutSubtitle || 'Review the purchase, accept the terms, then complete payment without leaving DealSifter.'}
              </p>
            </div>
            <div style={{ border: `1px solid ${C.alpha(summary.accent, 0.4)}`, borderRadius: 18, padding: 16, background: C.alpha(summary.accent, 0.08), display: 'grid', gap: 8 }}>
              <div style={{ color: C.t3, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                {t.checkoutOrderSummary || 'Order summary'}
              </div>
              <div style={{ color: C.t1, fontSize: 20, fontWeight: 900 }}>{summary.title}</div>
              <div style={{ color: C.t2, fontSize: 12 }}>{summary.subtitle}</div>
              <div style={{ color: summary.accent, fontSize: 28, fontWeight: 950, letterSpacing: '-.04em' }}>{summary.price}</div>
            </div>
            <div style={{ color: C.t3, fontSize: 11, lineHeight: 1.55 }}>
              {t.checkoutPoweredByStripe || 'Card data is handled by Stripe. DealSifter does not store sensitive card numbers.'}
            </div>
          </div>
        </aside>

        <section className="ds-checkout-modal-main">
          <div style={{ border: `1px solid ${accepted ? C.alpha(C.accent, 0.55) : C.border}`, borderRadius: 16, padding: 14, background: accepted ? C.alpha(C.accent, 0.07) : C.alpha(C.card, 0.92), display: 'grid', gap: 10 }}>
            <label style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 10, alignItems: 'start', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => {
                  setSessionError('');
                  setAccepted(event.target.checked);
                }}
                style={{ width: 18, height: 18, marginTop: 1, accentColor: C.accent }}
              />
              <span style={{ color: C.t2, fontSize: 12, lineHeight: 1.5 }}>
                {t.checkoutTermsPrefix || 'I agree to the'}{' '}
                <button type="button" onClick={onOpenTerms} style={{ border: 0, background: 'transparent', padding: 0, color: C.accent, fontWeight: 800, cursor: 'pointer' }}>
                  {t.checkoutTerms || 'Terms of Use'}
                </button>
                {' '}{t.checkoutTermsAnd || 'and'}{' '}
                <button type="button" onClick={onOpenPrivacy} style={{ border: 0, background: 'transparent', padding: 0, color: C.accent, fontWeight: 800, cursor: 'pointer' }}>
                  {t.checkoutPrivacy || 'Privacy Policy'}
                </button>
                {t.checkoutTermsSuffix || ', including billing and refund conditions before payment.'}
              </span>
            </label>
          </div>

          {!accepted ? (
            <div style={{ border: `1px dashed ${C.border}`, borderRadius: 16, padding: 18, color: C.t3, fontSize: 13, lineHeight: 1.5 }}>
              {t.checkoutAcceptHint || 'Accept the terms above to load the secure Stripe payment form.'}
            </div>
          ) : null}

          {accepted && !stripePromise ? (
            <div style={{ border: `1px solid ${C.warning || C.gold}`, borderRadius: 16, padding: 16, display: 'grid', gap: 10 }}>
              <strong style={{ color: C.t1 }}>{t.checkoutEmbeddedUnavailable || 'Embedded checkout unavailable'}</strong>
              <span style={{ color: C.t2, fontSize: 12 }}>{t.checkoutFallbackHint || 'We can still open the secure Stripe hosted checkout.'}</span>
            </div>
          ) : null}

          {sessionError ? (
            <div style={{ border: `1px solid ${C.warning || C.gold}`, borderRadius: 16, padding: 16, display: 'grid', gap: 10 }}>
              <strong style={{ color: C.t1 }}>{t.checkoutEmbeddedUnavailable || 'Embedded checkout unavailable'}</strong>
              <span style={{ color: C.t2, fontSize: 12 }}>{sessionError}</span>
              <span style={{ color: C.t3, fontSize: 12 }}>{t.checkoutFallbackHint || 'We can still open the secure Stripe hosted checkout.'}</span>
            </div>
          ) : null}

          {canRenderEmbedded ? (
            <div className="ds-checkout-embedded-frame" key={checkoutKey}>
              {isPreparingCheckout ? (
                <div style={{ minHeight: 120, display: 'grid', placeItems: 'center', color: C.t3, fontSize: 12, fontWeight: 800 }}>
                  {t.checkoutLoading || 'Loading secure Stripe checkout...'}
                </div>
              ) : null}
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{
                  fetchClientSecret,
                  onComplete: () => {
                    onComplete?.();
                  },
                }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onHostedFallback}
              disabled={!accepted}
              style={{ border: `1px solid ${accepted ? C.border : C.alpha(C.border, 0.65)}`, background: 'transparent', color: accepted ? C.t2 : C.t3, borderRadius: 12, padding: '10px 14px', fontSize: 12, fontWeight: 800, cursor: accepted ? 'pointer' : 'not-allowed', opacity: accepted ? 1 : 0.65 }}
            >
              {t.checkoutOpenHosted || 'Open hosted checkout'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ border: `1px solid ${C.border}`, background: C.card, color: C.t2, borderRadius: 12, padding: '10px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
            >
              {t.cancel || 'Cancel'}
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
