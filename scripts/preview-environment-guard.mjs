export const PREVIEW_STAGING_PROJECT_REF = 'oqdcnjupquhybwdbeeew';
export const PRODUCTION_PROJECT_REF = 'cyeipfskwwisbbayyaca';

function projectRefFromUrl(value) {
  try {
    return new URL(String(value || '')).hostname.split('.')[0].toLowerCase();
  } catch {
    return '';
  }
}

export function validatePreviewSupabaseEnvironment({ vercelEnv, supabaseUrl }) {
  if (vercelEnv !== 'preview') return { ok: true, status: 'NOT_PREVIEW' };
  const projectRef = projectRefFromUrl(supabaseUrl);
  if (projectRef !== PREVIEW_STAGING_PROJECT_REF) {
    return {
      ok: false,
      status: 'BUILD_DEPLOY_BLOCKED',
      reason: projectRef === PRODUCTION_PROJECT_REF
        ? 'PREVIEW_PRODUCTION_SUPABASE_FORBIDDEN'
        : 'PREVIEW_STAGING_TARGET_NOT_PROVEN',
    };
  }
  return { ok: true, status: 'PREVIEW_STAGING_CONFIRMED', projectRef };
}
