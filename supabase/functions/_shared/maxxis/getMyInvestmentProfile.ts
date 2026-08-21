import { createClient } from 'npm:@supabase/supabase-js@2';
import { supabaseAnonKey, supabaseUrl } from './config.ts';
import { extractInvestmentProfile, normalizeInvestmentProfile } from './normalizeInvestmentProfile.ts';

export async function getMyInvestmentProfileWithClient(userId: string, client: ReturnType<typeof createClient>) {
  if (!userId) throw new Error('INVESTMENT_PROFILE_UNAUTHORIZED');
  const { data, error } = await client.from('professional_profiles')
    .select('profile_payload')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('INVESTMENT_PROFILE_READ_FAILED');
  return normalizeInvestmentProfile(extractInvestmentProfile(data?.profile_payload));
}

export async function getMyInvestmentProfile(authHeader: string) {
  const token = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('INVESTMENT_PROFILE_UNAUTHORIZED');

  const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) throw new Error('INVESTMENT_PROFILE_UNAUTHORIZED');

  return getMyInvestmentProfileWithClient(user.id, client);
}
