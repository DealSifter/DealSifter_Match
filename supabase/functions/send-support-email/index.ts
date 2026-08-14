import { createClient } from 'npm:@supabase/supabase-js@2';
import { createRequestId, logOperationalEvent, withRequestId } from '../_shared/observability.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey =
  Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const supportEmailTo = Deno.env.get('SUPPORT_EMAIL_TO') ?? 'contato.dealsifter@gmail.com';
const supportEmailFrom = Deno.env.get('SUPPORT_EMAIL_FROM') ?? 'DealSifter Support <support@dealsifter.com>';

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing SUPABASE_ANON_KEY');
if (!supabaseServiceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200, requestId = '') {
  return withRequestId(new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  }), requestId);
}

async function getAuthenticatedUser(authHeader: string) {
  const accessToken = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return { user: null, error: 'Missing bearer token' };

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) return { user: null, error: String(error?.message || 'Invalid user session') };
  return { user, error: null };
}

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

Deno.serve(async (req) => {
  const requestId = createRequestId(req);
  const startedAt = Date.now();
  let userId = '';
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed', requestId }, 405, requestId);

  try {
    if (!resendApiKey) {
      logOperationalEvent({ functionName: 'send-support-email', operation: 'provider_configuration', requestId, durationMs: Date.now() - startedAt, success: false, errorCode: 'RESEND_NOT_CONFIGURED', status: 503, provider: 'resend' });
      return jsonResponse({ error: 'Support email is unavailable.', requestId }, 503, requestId);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const { user, error: authError } = await getAuthenticatedUser(authHeader);
    if (authError || !user) {
      logOperationalEvent({ functionName: 'send-support-email', operation: 'authenticate', requestId, durationMs: Date.now() - startedAt, success: false, errorCode: 'UNAUTHORIZED', status: 401, provider: 'supabase' });
      return jsonResponse({ error: 'Unauthorized', requestId }, 401, requestId);
    }
    userId = user.id;

    const body = await req.json().catch(() => ({}));
    const ticketId = String(body.ticketId || body.ticket_id || '').trim();
    const message = String(body.message || '').trim().slice(0, 4000);
    const direction = String(body.direction || 'user_to_support').trim();
    if (!ticketId || !message) return jsonResponse({ error: 'ticketId and message are required.', requestId }, 400, requestId);

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('support_tickets')
      .select('id, contact_id, ticket_number, user_id, user_email, subject')
      .eq('id', ticketId)
      .single();
    if (ticketError || !ticket) return jsonResponse({ error: 'Support ticket not found.', requestId }, 404, requestId);

    const { data: callerRow } = await supabaseAdmin
      .from('users')
      .select('email, full_name, is_admin')
      .eq('id', user.id)
      .single();

    const isAdmin = Boolean(callerRow?.is_admin);
    const isOwner = String(ticket.user_id) === String(user.id);
    if (!isOwner && !isAdmin) return jsonResponse({ error: 'Forbidden', requestId }, 403, requestId);

    const to = direction === 'admin_to_user'
      ? String(ticket.user_email || '').trim()
      : supportEmailTo;
    if (!to || !to.includes('@')) return jsonResponse({ error: 'No valid email recipient for this support ticket.', requestId }, 422, requestId);

    const subject = direction === 'admin_to_user'
      ? `DealSifter Support ${ticket.contact_id}`
      : `DealSifter Support ${ticket.contact_id} - ${ticket.subject || 'Support request'}`;
    const fromLabel = direction === 'admin_to_user'
      ? 'DealSifter Admin/Support'
      : `${callerRow?.full_name || 'DealSifter user'} <${callerRow?.email || ticket.user_email || 'unknown'}>`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: supportEmailFrom,
        to,
        reply_to: direction === 'admin_to_user' ? supportEmailTo : (callerRow?.email || ticket.user_email || supportEmailTo),
        subject,
        text: `Ticket: ${ticket.contact_id} (#${ticket.ticket_number})\nFrom: ${fromLabel}\n\n${message}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
            <p><strong>Ticket:</strong> ${escapeHtml(ticket.contact_id)} (#${escapeHtml(String(ticket.ticket_number || ''))})</p>
            <p><strong>From:</strong> ${escapeHtml(fromLabel)}</p>
            <div style="white-space:pre-wrap;border:1px solid #e5e7eb;border-radius:8px;padding:12px">${escapeHtml(message)}</div>
          </div>
        `,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      logOperationalEvent({ functionName: 'send-support-email', operation: 'send_message', requestId, userId, durationMs: Date.now() - startedAt, success: false, errorCode: 'RESEND_DELIVERY_FAILED', status: response.status, provider: 'resend' });
      return jsonResponse({ error: 'Support email delivery failed.', requestId }, response.status, requestId);
    }

    logOperationalEvent({ functionName: 'send-support-email', operation: 'send_message', requestId, userId, durationMs: Date.now() - startedAt, success: true, status: response.status, provider: 'resend' });
    return jsonResponse({ ok: true, provider: 'resend', id: payload?.id || null }, 200, requestId);
  } catch {
    logOperationalEvent({ functionName: 'send-support-email', operation: 'send_message', requestId, userId, durationMs: Date.now() - startedAt, success: false, errorCode: 'SUPPORT_EMAIL_INTERNAL_ERROR', status: 500, provider: 'resend' });
    return jsonResponse({ error: 'Internal error', requestId }, 500, requestId);
  }
});
