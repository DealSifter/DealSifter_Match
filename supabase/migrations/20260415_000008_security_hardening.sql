-- ============================================================
-- Migration 008 — Security hardening + LGPD consent fixes
-- ============================================================

-- 1. CRITICAL: Prevent privilege escalation via is_admin
--    Users must not be able to set is_admin = true via UPDATE.
--    Replace the permissive users_update_own with a safe version.
DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND is_admin = (SELECT u.is_admin FROM public.users u WHERE u.id = auth.uid())
  );

-- 2. LGPD: Fix delete_user_account to ANONIMIZE consent records
--    instead of deleting them (Art. 16, I — audit trail).
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only the owner can delete their own account
  IF auth.uid() IS NULL OR auth.uid() != target_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Cascade delete user data (but NOT consent_records)
  DELETE FROM public.property_images WHERE property_id IN (
    SELECT id FROM public.properties WHERE owner_id = target_user_id
  );
  DELETE FROM public.properties WHERE owner_id = target_user_id;
  DELETE FROM public.services WHERE owner_id = target_user_id;
  DELETE FROM public.matches WHERE buyer_id = target_user_id OR seller_id = target_user_id;
  DELETE FROM public.unlocks WHERE buyer_id = target_user_id OR seller_id = target_user_id;
  DELETE FROM public.professional_profiles WHERE user_id = target_user_id;
  DELETE FROM public.user_profiles WHERE user_id = target_user_id;

  -- Anonimize consent records (preserve for LGPD audit trail)
  UPDATE public.consent_records
  SET user_id = NULL,
      anonymous_id = 'deleted-' || target_user_id::text,
      revoked_at = now()
  WHERE user_id = target_user_id;

  -- Delete the public.users row (trigger won't cascade to auth.users)
  DELETE FROM public.users WHERE id = target_user_id;
END;
$$;

-- 3. Performance indexes for matches and consent
CREATE INDEX IF NOT EXISTS idx_matches_buyer_id ON public.matches(buyer_id);
CREATE INDEX IF NOT EXISTS idx_matches_seller_id ON public.matches(seller_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_user_id ON public.consent_records(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consent_records_anonymous_id ON public.consent_records(anonymous_id) WHERE user_id IS NULL;
