import { describe, expect, it } from 'vitest';
import {
  PREVIEW_STAGING_PROJECT_REF,
  validatePreviewSupabaseEnvironment,
} from './preview-environment-guard.mjs';

describe('Vercel Preview environment guard', () => {
  it('allows Preview only when the canonical staging project is proven', () => {
    expect(validatePreviewSupabaseEnvironment({
      vercelEnv: 'preview',
      supabaseUrl: `https://${PREVIEW_STAGING_PROJECT_REF}.supabase.co`,
    })).toMatchObject({ ok: true, status: 'PREVIEW_STAGING_CONFIRMED' });
  });

  it('blocks production Supabase in Preview', () => {
    expect(validatePreviewSupabaseEnvironment({
      vercelEnv: 'preview',
      supabaseUrl: 'https://cyeipfskwwisbbayyaca.supabase.co',
    })).toMatchObject({ ok: false, reason: 'PREVIEW_PRODUCTION_SUPABASE_FORBIDDEN' });
  });

  it('fails closed when the Preview target is missing or unknown', () => {
    expect(validatePreviewSupabaseEnvironment({ vercelEnv: 'preview', supabaseUrl: '' }))
      .toMatchObject({ ok: false, reason: 'PREVIEW_STAGING_TARGET_NOT_PROVEN' });
  });
});
