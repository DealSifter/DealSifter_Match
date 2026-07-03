import { createClient } from 'npm:@supabase/supabase-js@2';

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

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    if (!resendApiKey) {
      return jsonResponse({ error: 'RESEND_API_KEY is not configured for support email delivery.' }, 503);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const { user, error: authError } = await getAuthenticatedUser(authHeader);
    if (authError || !user) return jsonResponse({ error: authError || 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const ticketId = String(body.ticketId || body.ticket_id || '').trim();
    const message = String(body.message || '').trim().slice(0, 4000);
    const direction = String(body.direction || 'user_to_support').trim();
    if (!ticketId || !message) return jsonResponse({ error: 'ticketId and message are required.' }, 400);

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('support_tickets')
      .select('id, contact_id, ticket_number, user_id, user_email, subject')
      .eq('id', ticketId)
      .single();
    if (ticketError || !ticket) return jsonResponse({ error: 'Support ticket not found.' }, 404);

    const { data: callerRow } = await supabaseAdmin
      .from('users')
      .select('email, full_name, is_admin')
      .eq('id', user.id)
      .single();

    const isAdmin = Boolean(callerRow?.is_admin);
    const isOwner = String(ticket.user_id) === String(user.id);
    if (!isOwner && !isAdmin) return jsonResponse({ error: 'Forbidden' }, 403);

    const to = direction === 'admin_to_user'
      ? String(ticket.user_email || '').trim()
      : supportEmailTo;
    if (!to || !to.includes('@')) return jsonResponse({ error: 'No valid email recipient for this support ticket.' }, 422);

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
      return jsonResponse({ error: payload?.message || 'Support email delivery failed.', details: payload }, response.status);
    }

    return jsonResponse({ ok: true, provider: 'resend', id: payload?.id || null });
  } catch (err) {
    console.error('send-support-email failed:', err);
    return jsonResponse({ error: String((err as Error)?.message || err || 'Support email failed') }, 500);
  }
});
