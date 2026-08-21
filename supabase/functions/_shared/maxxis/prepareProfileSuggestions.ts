import { createClient } from 'npm:@supabase/supabase-js@2';
import { supabaseAnonKey, supabaseUrl } from './config.ts';
import type { ProfileDriftSuggestion } from './types.ts';
import { validateProfileSuggestion } from './validateProfileSuggestion.ts';

export async function prepareProfileSuggestions(
  suggestions: ProfileDriftSuggestion[],
  authHeader: string,
): Promise<ProfileDriftSuggestion[]> {
  const valid = (Array.isArray(suggestions) ? suggestions : []).slice(0, 3).flatMap((suggestion) => {
    const result = validateProfileSuggestion(suggestion);
    return result.valid ? [{ original: suggestion, validated: result.suggestion }] : [];
  });
  if (!valid.length) return [];

  const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await client.rpc('ds_prepare_maxxis_profile_actions', {
    p_suggestions: valid.map((item) => item.validated),
  });
  if (error) throw new Error('MAXXIS_ACTION_PREPARE_FAILED');

  const rows = Array.isArray(data) ? data : [];
  return valid.flatMap(({ original, validated }) => {
    const row = rows.find((item) => (
      String(item.operation || '') === validated.operation
      && String(item.suggested_value || '').toLowerCase() === validated.suggestedValue.toLowerCase()
    ));
    if (!row?.action_id) return [];
    return [{
      ...original,
      operation: validated.operation,
      dimension: validated.dimension,
      suggestedValue: validated.suggestedValue,
      pendingActionId: String(row.action_id),
      expiresAt: String(row.expires_at || ''),
    }];
  });
}
