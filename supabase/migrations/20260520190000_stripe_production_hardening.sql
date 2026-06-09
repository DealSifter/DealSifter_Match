-- Stripe production hardening for DealSifter billing.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_sub_id text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscriptions'
      AND column_name = 'stripe_subscription_id'
  ) THEN
    UPDATE public.subscriptions
    SET stripe_sub_id = stripe_subscription_id
    WHERE stripe_sub_id IS NULL
      AND stripe_subscription_id IS NOT NULL;
  END IF;
END $$;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'past_due', 'canceled', 'trialing', 'incomplete', 'unpaid', 'paused'));

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_key
  ON public.subscriptions (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_sub_id_key
  ON public.subscriptions (stripe_sub_id)
  WHERE stripe_sub_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_customer_id_key
  ON public.subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

ALTER TABLE public.nugget_purchases
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

CREATE UNIQUE INDEX IF NOT EXISTS nugget_purchases_checkout_session_key
  ON public.nugget_purchases (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS nugget_purchases_payment_id_key
  ON public.nugget_purchases (stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;
