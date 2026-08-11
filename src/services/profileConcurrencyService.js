import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

export const PROFILE_CONFLICT_CODE = 'PROFILE_CONFLICT';

export class ProfileConflictError extends Error {
  constructor(result = {}) {
    super(String(result.message || 'Your profile was updated elsewhere.'));
    this.name = 'ProfileConflictError';
    this.code = PROFILE_CONFLICT_CODE;
    this.currentVersion = Number(result.currentVersion || 0);
  }
}

export const isProfileConflictError = (error) => error?.code === PROFILE_CONFLICT_CODE;

export async function saveProfessionalProfileWithVersion({
  expectedVersion,
  profilePayload,
  fields,
  updatePhotoBUrl = false,
  photoBUrl = null,
}) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Profile persistence is unavailable.');
  const version = Number(expectedVersion);
  if (!Number.isSafeInteger(version) || version < 0) throw new Error('Invalid expected profile version.');

  const { data, error } = await supabase.rpc('ds_save_professional_profile', {
    p_expected_version: version,
    p_profile_payload: profilePayload,
    p_category: fields?.category ?? null,
    p_subcategory: fields?.subcategory ?? null,
    p_markets: Array.isArray(fields?.markets) ? fields.markets : [],
    p_skills: Array.isArray(fields?.skills) ? fields.skills : [],
    p_services: Array.isArray(fields?.services) ? fields.services : [],
    p_pitch: fields?.pitch ?? null,
    p_primary_category: fields?.primary_category ?? null,
    p_category_b: fields?.category_b ?? null,
    p_primary_category_b: fields?.primary_category_b ?? null,
    p_update_photo_b_url: Boolean(updatePhotoBUrl),
    p_photo_b_url: photoBUrl,
  });
  if (error) throw error;
  if (data?.code === PROFILE_CONFLICT_CODE || data?.success === false) throw new ProfileConflictError(data);
  if (data?.success !== true || !Number.isSafeInteger(Number(data.profileVersion))) {
    throw new Error('Invalid profile persistence response.');
  }
  return {
    profileVersion: Number(data.profileVersion),
    updatedAt: String(data.updatedAt || ''),
  };
}
