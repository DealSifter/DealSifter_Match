-- Migration: Nuggets column + credit_nuggets RPC + plan column on users

-- ─────────────────────────────────────────────────────────────
-- 1. Add nuggets and plan_id columns to users table
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS nuggets    integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS plan_id    text    NOT NULL DEFAULT 'free';

-- ─────────────────────────────────────────────────────────────
-- 2. RPC: credit_nuggets — atomically add nuggets to a user
--    Called by the stripe-webhook edge function (service_role).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.credit_nuggets(p_user_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users
  SET nuggets = nuggets + p_amount,
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. RLS — users can only read their own nuggets & plan_id
--    (existing RLS policies on `users` cover SELECT for owner)
-- ─────────────────────────────────────────────────────────────
-- No additional policies needed — existing owner SELECT policy covers these columns.
-- Service role used by webhook bypasses RLS automatically.
