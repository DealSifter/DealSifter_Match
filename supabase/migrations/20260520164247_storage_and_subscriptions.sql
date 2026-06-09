-- Migration: Storage buckets + subscriptions + nugget_purchases
-- Requires: Supabase Storage extension enabled in dashboard

-- ─────────────────────────────────────────────────────────────
-- 1. Storage buckets
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('property-images', 'property-images', true),
  ('profile-images',  'profile-images',  true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for property-images
DROP POLICY IF EXISTS "property_images_public_read" ON storage.objects;
CREATE POLICY "property_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-images');

DROP POLICY IF EXISTS "property_images_owner_insert" ON storage.objects;
CREATE POLICY "property_images_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'property-images'
    AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "property_images_owner_delete" ON storage.objects;
CREATE POLICY "property_images_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'property-images'
    AND owner = auth.uid()
  );

-- RLS policies for profile-images
DROP POLICY IF EXISTS "profile_images_public_read" ON storage.objects;
CREATE POLICY "profile_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-images');

DROP POLICY IF EXISTS "profile_images_owner_insert" ON storage.objects;
CREATE POLICY "profile_images_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-images'
    AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "profile_images_owner_delete" ON storage.objects;
CREATE POLICY "profile_images_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'profile-images'
    AND owner = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────
-- 2. Subscriptions table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_sub_id      text,
  plan_id            text NOT NULL DEFAULT 'free',
  plan_name          text NOT NULL DEFAULT 'Free',
  price_cents        integer NOT NULL DEFAULT 0,
  status             text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  current_period_end timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_sub_id text,
  ADD COLUMN IF NOT EXISTS plan_id text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_name text NOT NULL DEFAULT 'Free',
  ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

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

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_owner_select" ON subscriptions;
CREATE POLICY "subscriptions_owner_select"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "subscriptions_service_all" ON subscriptions;
CREATE POLICY "subscriptions_service_all"
  ON subscriptions FOR ALL
  USING (current_setting('role') = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- 3. Nugget purchases table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nugget_purchases (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_payment_id   text,
  pack_id             text NOT NULL,
  qty                 integer NOT NULL,
  bonus               integer NOT NULL DEFAULT 0,
  price_cents         integer NOT NULL,
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'completed', 'refunded')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nugget_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nugget_purchases_owner_select" ON nugget_purchases;
CREATE POLICY "nugget_purchases_owner_select"
  ON nugget_purchases FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "nugget_purchases_service_all" ON nugget_purchases;
CREATE POLICY "nugget_purchases_service_all"
  ON nugget_purchases FOR ALL
  USING (current_setting('role') = 'service_role');
