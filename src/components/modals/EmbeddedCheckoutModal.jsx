import React, { useState } from 'react';
import { C } from '../../theme/colors';
import { useT } from '../../i18n/translations';
import { NUGGET_PACKS, PLANS } from '../../data/mockData';
import appLogo from '../../assets/logo.png';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';

function resolveCheckoutSummary(intent, t) {
  if (intent?.kind === 'subscription') {
    const plan = PLANS.find((item) => String(item.id) === String(intent.planId));
    const name = t.planNames?.[intent.planId] || plan?.name || String(intent.planId || '').toUpperCase();
    const billingCycle = String(intent.billingCycle || intent.billing_cycle || 'monthly').toLowerCase() === 'annual'
      ? 'annual'
      : 'monthly';
    const annualTotal = plan ? Math.round(Number(plan.price || 0) * 12 * 0.85) : 0;
    return {
      title: name,
      subtitle: billingCycle === 'annual'
        ? (t.billingAnnual || 'Annual · save {discount}%').replace('{discount}', 15)
        : (t.checkoutSubscription || 'Subscription plan'),
      price: plan
        ? billingCycle === 'annual'
          ? `$${Number(annualTotal || 0).toLocaleString('en-US')}/yr`
          : `$${Number(plan.price || 0).toLocaleString('en-US')}/mo`
        : '',
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
  checkoutError = '',
  isSubmitting = false,
  onClose,
  onHostedFallback,
  onOpenTerms,
  onOpenPrivacy,
}) {
  const allT = useT();
  const t = allT.modals || {};
  const pricingT = allT.pricing || {};
  const [accepted, setAccepted] = useState(false);
  const summary = resolveCheckoutSummary(intent, pricingT);
  const isNuggetCheckout = intent?.kind === 'nuggets';
  const orderCardTextColor = isNuggetCheckout ? '#121a16' : C.t1;
  const orderCardMutedColor = isNuggetCheckout ? 'rgba(18,26,22,0.72)' : C.t2;
  const orderCardBackground = isNuggetCheckout ? C.gold : C.alpha(summary.accent, 0.1);

  return (
    <Modal
      onClose={onClose}
      maxWidth={860}
      ariaLabel={t.checkoutTitle || 'Secure checkout'}
      contentStyle={{ padding: 0, overflow: 'hidden', maxHeight: 'calc(100dvh - 34px)' }}
    >
      <style>{`
        .ds-checkout-modal-shell {
          display: grid;
          grid-template-columns: minmax(220px, 292px) minmax(0, 1fr);
          min-height: 0;
          max-height: calc(100dvh - 34px);
          overflow: hidden;
        }
        .ds-checkout-modal-side {
          padding: 22px;
          background: ${C.card};
          border-right: 1px solid ${C.border};
        }
        .ds-checkout-modal-main {
          padding: 22px;
          display: grid;
          align-content: start;
          gap: 12px;
          min-width: 0;
          overflow: hidden;
        }
        .ds-checkout-terms-box {
          animation: dsCheckoutTermsPulse 1.18s ease-in-out infinite;
        }
        .ds-checkout-hosted-panel {
          border: 1px solid ${C.border};
          border-radius: 16px;
          padding: 14px;
          background: ${C.card};
          display: grid;
          gap: 8px;
        }
        .ds-checkout-modal-action {
          transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
        }
        .ds-checkout-modal-action:not(:disabled):hover {
          transform: translateY(-1px);
        }
        @keyframes dsCheckoutTermsPulse {
          0%, 100% { border-color: ${C.gold}; box-shadow: 0 0 0 0 ${C.alpha(C.gold, 0.18)}; }
          50% { border-color: ${C.gold}; box-shadow: 0 0 0 5px ${C.alpha(C.gold, 0.24)}, 0 0 22px ${C.alpha(C.gold, 0.28)}; }
        }
        @media (max-width: 760px) {
          .ds-checkout-modal-shell { grid-template-columns: 1fr; }
          .ds-checkout-modal-side { border-right: 0; border-bottom: 1px solid ${C.border}; padding: 14px 16px; }
          .ds-checkout-modal-main { padding: 14px 16px; gap: 10px; }
        }
      `}</style>

      <div className="ds-checkout-modal-shell">
        <aside className="ds-checkout-modal-side">
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: C.accent, fontWeight: 900, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              <Icon name="shield" size={16} color={C.accent} />
              {t.checkoutSecureBadge || 'Secure Stripe Checkout'}
            </div>
            <div>
              <h2 style={{ margin: '0 0 7px', color: C.t1, fontSize: 'clamp(22px, 3vw, 30px)', lineHeight: 1.02, letterSpacing: '-.04em' }}>
                {t.checkoutTitle || 'Secure checkout'}
              </h2>
              <p style={{ margin: 0, color: C.t2, fontSize: 12, lineHeight: 1.45 }}>
                {t.checkoutSubtitle || 'Review the purchase, accept the terms, then complete payment without leaving DealSifter.'}
              </p>
            </div>
            <div style={{ border: `1px solid ${isNuggetCheckout ? '#d89c00' : C.alpha(summary.accent, 0.42)}`, borderRadius: 16, padding: 14, background: orderCardBackground, display: 'grid', gap: 6 }}>
              <div style={{ color: isNuggetCheckout ? 'rgba(18,26,22,0.7)' : C.t3, fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                {t.checkoutOrderSummary || 'Order summary'}
              </div>
              <div style={{ color: orderCardTextColor, fontSize: 19, fontWeight: 950 }}>{summary.title}</div>
              <div style={{ color: orderCardMutedColor, fontSize: 11, fontWeight: 700 }}>{summary.subtitle}</div>
              <div style={{ color: orderCardTextColor, fontSize: 27, fontWeight: 950, letterSpacing: '-.04em' }}>{summary.price}</div>
            </div>
            <div style={{ color: C.t3, fontSize: 10.5, lineHeight: 1.45 }}>
              {t.checkoutPoweredByStripe || 'Card data is handled by Stripe. DealSifter does not store sensitive card numbers.'}
            </div>
          </div>
        </aside>

        <section className="ds-checkout-modal-main">
          <div className="ds-checkout-terms-box" style={{ border: `1px solid ${C.gold}`, borderRadius: 16, padding: 13, background: accepted ? C.alpha(C.gold, 0.12) : C.alpha(C.gold, 0.07), display: 'grid', gap: 8 }}>
            <label style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 10, alignItems: 'start', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                style={{ width: 18, height: 18, marginTop: 1, accentColor: C.accent }}
              />
              <span style={{ color: C.t2, fontSize: 12, lineHeight: 1.45 }}>
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
            <div style={{ border: `1px dashed ${C.border}`, borderRadius: 14, padding: 12, color: C.t3, fontSize: 12, lineHeight: 1.4 }}>
              {t.checkoutAcceptHint || 'Accept the terms above to continue to secure Stripe Checkout.'}
            </div>
          ) : null}

          <div className="ds-checkout-hosted-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={appLogo} alt="DealSifter" style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }} />
              <strong style={{ color: C.t1, fontSize: 15 }}>
                {accepted ? (t.checkoutReadyTitle || 'Ready for secure payment') : (t.checkoutAcceptRequiredTitle || 'Terms acceptance required')}
              </strong>
            </div>
            <p style={{ margin: 0, color: C.t2, fontSize: 12, lineHeight: 1.45 }}>
              {isSubmitting
                ? (t.checkoutPreparingHint || 'Creating your secure Stripe session. Do not close this window.')
                : accepted
                ? (t.checkoutHostedRedirectInfo || 'Click below to open secure Stripe Checkout. Stripe will return you to DealSifter after payment.')
                : (t.checkoutAcceptHint || 'Accept the terms above to continue to secure Stripe Checkout.')}
            </p>
          </div>

          {checkoutError ? (
            <div role="alert" style={{ border: `1px solid ${C.danger}`, background: C.alpha(C.danger, 0.08), color: C.danger, borderRadius: 12, padding: '10px 12px', fontSize: 12, fontWeight: 800, lineHeight: 1.35 }}>
              {checkoutError}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <button
              className="ds-checkout-modal-action"
              type="button"
              onClick={() => {
                if (!accepted || isSubmitting) return;
                onHostedFallback?.();
              }}
              disabled={!accepted || isSubmitting}
              style={{ border: `1px solid ${accepted ? C.accent : C.alpha(C.border, 0.65)}`, background: accepted ? C.accent : 'transparent', color: accepted ? '#fff' : C.t3, borderRadius: 12, padding: '10px 16px', fontSize: 12, fontWeight: 900, cursor: accepted && !isSubmitting ? 'pointer' : 'not-allowed', opacity: accepted ? 1 : 0.65, boxShadow: accepted ? `0 10px 22px ${C.alpha(C.accent, 0.24)}` : 'none' }}
            >
              {isSubmitting ? (t.checkoutPreparing || 'Preparing checkout...') : (t.checkoutOpenHosted || 'Open hosted checkout')}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ border: `1px solid ${C.border}`, background: C.card, color: C.t2, borderRadius: 12, padding: '10px 14px', fontSize: 12, fontWeight: 800, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.55 : 1 }}
            >
              {t.cancel || 'Cancel'}
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
