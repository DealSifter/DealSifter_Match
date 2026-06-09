-- ============================================================
-- Migration 007 — RLS gap fixes
-- Adds missing policies identified in security audit
-- ============================================================

-- 1. consent_records: allow user to UPDATE own rows (revoke consent via revoked_at)
CREATE POLICY consent_records_update_own
  ON public.consent_records
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. property_images: allow user to UPDATE own rows (reorder sort_order, change url/label)
CREATE POLICY property_images_update_own
  ON public.property_images
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE properties.id = property_images.property_id
        AND properties.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE properties.id = property_images.property_id
        AND properties.owner_id = auth.uid()
    )
  );

-- 3. matches: allow buyer to DELETE own matches (unmatch)
CREATE POLICY matches_delete_own
  ON public.matches
  FOR DELETE
  USING (buyer_id = auth.uid());
