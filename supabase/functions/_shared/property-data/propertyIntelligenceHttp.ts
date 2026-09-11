import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, parseAllowedOrigins } from '../maxxis/corsPolicy.ts';
import {
  createBackendPropertyEvidenceService,
  type PropertyEvidenceBackendClient,
} from './backendFactory.ts';
import { resolvePropertyIntelligenceAccess } from './propertyIntelligenceAccess.ts';
import { propertyIntelligenceExposed } from './exposure.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const allowedOrigins = parseAllowedOrigins(
  Deno.env.get('PROPERTY_INTELLIGENCE_ALLOWED_ORIGINS') || '',
  [Deno.env.get('APP_URL') || '', Deno.env.get('VITE_APP_URL') || ''],
);
const corsHeaders = (origin = '') => buildCorsHeaders(origin, allowedOrigins);

function json(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function handlePropertyIntelligenceRequest(req: Request) {
  const origin = req.headers.get('Origin') || '';
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ success: false, state: 'unavailable', error: 'METHOD_NOT_ALLOWED' }, 405, origin);
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return json({ success: true, state: 'locked', entitled: false, authRequired: true }, 200, origin);
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return json({ success: true, state: 'locked', entitled: false, authRequired: true }, 200, origin);
  if (!propertyIntelligenceExposed(name => Deno.env.get(name), user.id)) return json({ success: true, state: 'hidden' }, 200, origin);
  const body = await req.json().catch(() => ({}));
  const propertyId = String(body?.propertyId || '').trim();

  const result = await resolvePropertyIntelligenceAccess({
    dataMode: Deno.env.get('PROPERTY_DATA_MODE') === 'live' ? 'live' : 'disabled',
    userId: user.id,
    propertyId,
    hasEntitlement: async (_userId, candidatePropertyId) => {
      const { data, error } = await client.rpc('ds_has_property_intelligence_entitlement', {
        p_property_id: candidatePropertyId,
        p_unlock_type: 'property_record',
      });
      if (error) throw new Error('PROPERTY_INTELLIGENCE_ENTITLEMENT_CHECK_FAILED');
      return data === true;
    },
    loadEvidence: async (candidatePropertyId, userId) => {
      if (!supabaseServiceRoleKey) throw new Error('PROPERTY_INTELLIGENCE_BACKEND_UNAVAILABLE');
      const admin = createClient(supabaseUrl, supabaseServiceRoleKey) as unknown as PropertyEvidenceBackendClient;
      const service = createBackendPropertyEvidenceService({
        supabaseAdmin: admin,
        getEnv: (name) => name === 'PROPERTY_DATA_MODE' ? (Deno.env.get(name) === 'live' ? 'live' : 'disabled') : Deno.env.get(name),
      });
      return service.getPropertyEvidence({ propertyId: candidatePropertyId, userId });
    },
  }).catch(() => ({
    success: false as const,
    state: 'unavailable' as const,
    error: 'PROPERTY_INTELLIGENCE_UNAVAILABLE',
  }));

  return json(result, result.error === 'INVALID_PROPERTY' ? 400 : 200, origin);
}
