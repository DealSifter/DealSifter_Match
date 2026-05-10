-- Backfill deterministic scoped payloads for legacy rows that were saved
-- before profile_payload started being persisted.
update public.professional_profiles pp
set profile_payload = jsonb_build_object(
  'version', 1,
  'accountType', 'professional',
  'resolved', jsonb_build_object(
    'personal', jsonb_build_object(
      'scope', 'personal',
      'name', coalesce(up.full_name, ''),
      'loc', '',
      'photo', coalesce(up.photo_url, ''),
      'categoryId', coalesce(pp.primary_category, pp.category, ''),
      'categoryLabelFallback', coalesce(pp.category, pp.primary_category, 'Professional'),
      'badge', 'Profile',
      'pitch', coalesce(up.bio, ''),
      'contactMethods', '[]'::jsonb,
      'primaryPhone', '',
      'secondaryPhone', '',
      'tertiaryPhone', '',
      'email', '',
      'cardPriority', 'primary',
      'accountType', 'professional'
    ),
    'professional', jsonb_build_object(
      'scope', 'professional',
      'name', coalesce(up.full_name, pp.category_b, pp.primary_category_b, pp.category, 'Secondary Profile'),
      'loc', '',
      'photo', coalesce(pp.photo_b_url, up.photo_url, ''),
      'categoryId', coalesce(pp.primary_category_b, pp.category_b, ''),
      'categoryLabelFallback', coalesce(pp.category_b, pp.primary_category_b, 'Professional'),
      'badge', 'Professional',
      'pitch', coalesce(pp.pitch, ''),
      'contactMethods', '[]'::jsonb,
      'primaryPhone', '',
      'secondaryPhone', '',
      'tertiaryPhone', '',
      'email', '',
      'cardPriority', 'secondary',
      'accountType', 'professional'
    ),
    'fsbo', jsonb_build_object(
      'scope', 'fsbo',
      'name', coalesce(up.full_name, ''),
      'loc', '',
      'photo', coalesce(up.photo_url, ''),
      'categoryId', coalesce(pp.primary_category, pp.category, ''),
      'categoryLabelFallback', 'FSBO (C)',
      'badge', 'FSBO',
      'pitch', coalesce(up.bio, ''),
      'contactMethods', '[]'::jsonb,
      'primaryPhone', '',
      'secondaryPhone', '',
      'tertiaryPhone', '',
      'email', '',
      'cardPriority', 'tertiary',
      'accountType', 'professional'
    )
  ),
  'profiles', jsonb_build_object(
    'personal', jsonb_build_object(
      'fullName', coalesce(up.full_name, ''),
      'photo', coalesce(up.photo_url, ''),
      'bio', coalesce(up.bio, ''),
      'visibility', coalesce(up.visibility, 'hidden'),
      'loc', '',
      'contactMethods', '[]'::jsonb,
      'primaryPhone', '',
      'secondaryPhone', '',
      'tertiaryPhone', '',
      'email', '',
      'cardPriorityA', 'primary',
      'cardPriorityC', 'tertiary'
    ),
    'professional', jsonb_build_object(
      'fullName', coalesce(up.full_name, pp.category_b, pp.primary_category_b, pp.category, 'Secondary Profile'),
      'locB', '',
      'photoB', coalesce(pp.photo_b_url, up.photo_url, ''),
      'photoBUrl', coalesce(pp.photo_b_url, up.photo_url, ''),
      'contactMethodsB', '[]'::jsonb,
      'primaryPhoneB', '',
      'secondaryPhoneB', '',
      'tertiaryPhoneB', '',
      'emailB', '',
      'cardPriorityB', 'secondary',
      'pitchB', coalesce(pp.pitch, '')
    ),
    'fsbo', jsonb_build_object(
      'fullName', coalesce(up.full_name, ''),
      'photo', coalesce(up.photo_url, ''),
      'bio', coalesce(up.bio, ''),
      'visibility', coalesce(up.visibility, 'hidden'),
      'loc', '',
      'contactMethods', '[]'::jsonb,
      'primaryPhone', '',
      'secondaryPhone', '',
      'tertiaryPhone', '',
      'email', '',
      'cardPriorityA', 'primary',
      'cardPriorityC', 'tertiary'
    )
  ),
  'legacy', jsonb_build_object(
    'personalProfile', jsonb_build_object(
      'fullName', coalesce(up.full_name, ''),
      'photo', coalesce(up.photo_url, ''),
      'bio', coalesce(up.bio, ''),
      'visibility', coalesce(up.visibility, 'hidden')
    ),
    'professionalProfile', jsonb_build_object(
      'category', coalesce(pp.category, ''),
      'subcategory', coalesce(pp.subcategory, ''),
      'markets', to_jsonb(coalesce(pp.markets, '{}'::text[])),
      'skills', to_jsonb(coalesce(pp.skills, '{}'::text[])),
      'services', to_jsonb(coalesce(pp.services, '{}'::text[])),
      'pitch', coalesce(pp.pitch, ''),
      'primaryCategory', coalesce(pp.primary_category, ''),
      'categoryB', coalesce(pp.category_b, ''),
      'primaryCategoryB', coalesce(pp.primary_category_b, ''),
      'photoBUrl', coalesce(pp.photo_b_url, '')
    )
  )
)
from public.user_profiles up
where up.user_id = pp.user_id
  and coalesce(pp.profile_payload, '{}'::jsonb) = '{}'::jsonb;
