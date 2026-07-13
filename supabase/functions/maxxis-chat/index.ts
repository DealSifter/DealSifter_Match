import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY') ?? '';
const configuredGeminiModel = Deno.env.get('MAXXIS_GEMINI_MODEL') ?? '';
const geminiModels = [
  configuredGeminiModel,
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
].filter(Boolean);

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing SUPABASE_ANON_KEY');

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

function sanitizeText(value: unknown, maxLength = 2400) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function detectLanguage(text: string, preferredLanguage = 'auto') {
  const normalized = ` ${String(text || '').toLowerCase()} `;
  const ptHits = [
    ' voce ', ' você ', ' por onde ', ' começar ', ' consegue ', ' responder ', ' portugues ',
    ' português ', ' ajuda ', ' obrigado ', ' duvida ', ' dúvida ', ' imovel ', ' imóvel ',
    ' negocio ', ' negócio ', ' desbloquear ', ' tela ', ' usuario ', ' usuário ',
  ].filter((word) => normalized.includes(word)).length;
  const esHits = [
    ' usted ', ' puedes ', ' puedo ', ' empezar ', ' español ', ' gracias ', ' ayuda ',
    ' inmueble ', ' desbloquear ', ' pantalla ', ' usuario ', ' negocio ', ' propiedad ',
  ].filter((word) => normalized.includes(word)).length;

  if (ptHits > esHits && ptHits > 0) return 'pt';
  if (esHits > ptHits && esHits > 0) return 'es';

  const preferred = String(preferredLanguage || '').slice(0, 2).toLowerCase();
  return ['en', 'pt', 'es'].includes(preferred) ? preferred : 'en';
}

function buildSystemPrompt(language: string, page: string) {
  return `
You are Maxxis, the AI guide for DealSifter Match.

Mission:
- Help users understand and use DealSifter Match.
- Explain Feed, MapView, Matches, onboarding, pricing, nuggets, unlocks, exclusivity, spotlight cards, support chat, and account settings.
- Teach general US real estate concepts limited to Tax Deed investing and Wholesale Real Estate.

Tone:
- Professional, friendly, precise, and didactic.
- Audience is analytical; keep explanations structured and practical.
- Be enthusiastic without being informal.

Strict boundaries:
- Do not reveal internal secrets, keys, backend implementation details, SQL, private logs, or security internals.
- Do not provide legal, tax, financial, or investment advice as a professional recommendation.
- Do not invent app features. If unsure, say that support can confirm.
- Stay inside DealSifter Match, Tax Deeds, Wholesale Real Estate, and closely related app usage.
- For billing, bugs, payment failures, critical account issues, or backend-specific problems, suggest contacting human support.
- Never request passwords, API keys, full card numbers, Stripe secrets, Supabase secrets, or sensitive personal data.

Current app context:
- Current page: ${page || 'unknown'}
- Detected user language: ${language || 'en'}
- Answer directly in the detected user language. If the user writes in Portuguese, answer in Portuguese. If Spanish, answer in Spanish. If English, answer in English.

DealSifter summary:
- Feed is for card discovery, swipes, favorites, unlocks, spotlight, and showcase opportunities.
- MapView is for geographical discovery using pins, clusters, filters, My PINs, People, Deals, and Spotlight Cards.
- Matches is for unlocked contacts, portfolio details, interests, chat, and relationship history.
- Nuggets are the app currency used for unlocks, spotlight, and paid interactions.
- Unlock cost should be confirmed before purchase; contacts appear after server-confirmed entitlement.
- Exclusive unlock temporarily blocks competing access to the exclusive property/contact context.
- The support chat is the right path for account, billing, or technical issues that need staff help.

Response style:
- Prefer concise paragraphs and short bullet lists.
- Give step-by-step instructions when explaining app usage.
- End with one useful next step when appropriate.
`;
}

function toGeminiRole(role: unknown) {
  return String(role || '').toLowerCase() === 'assistant' ? 'model' : 'user';
}

async function callGemini(model: string, body: Record<string, unknown>) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const { user, error: authError } = await getAuthenticatedUser(authHeader);
    if (authError || !user) return jsonResponse({ error: authError || 'Unauthorized' }, 401);

    if (!geminiApiKey) {
      return jsonResponse({
        error: 'MAXXIS_NOT_CONFIGURED',
        message: 'Maxxis AI is not configured. Add GEMINI_API_KEY as a Supabase Edge Function secret.',
      }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const message = sanitizeText(body.message, 1800);
    const language = detectLanguage(message, sanitizeText(body.language || 'auto', 8));
    const page = sanitizeText(body.page || 'unknown', 60);
    const history = Array.isArray(body.history) ? body.history.slice(-10) : [];

    if (!message) return jsonResponse({ error: 'Message is required.' }, 400);

    const contents = [
      ...history
        .map((item: Record<string, unknown>) => ({
          role: toGeminiRole(item?.role),
          parts: [{ text: sanitizeText(item?.content || item?.text, 1600) }],
        }))
        .filter((item) => item.parts[0].text),
      {
        role: 'user',
        parts: [{ text: message }],
      },
    ];

    const geminiRequest = {
      systemInstruction: {
        parts: [{ text: buildSystemPrompt(language, page) }],
      },
      contents,
      generationConfig: {
        temperature: 0.45,
        topP: 0.9,
        maxOutputTokens: 900,
      },
    };

    let payload: Record<string, unknown> = {};
    const providerErrors: Array<Record<string, unknown>> = [];
    for (const model of geminiModels) {
      const result = await callGemini(model, geminiRequest);
      payload = result.payload;
      if (result.response.ok) {
        providerErrors.length = 0;
        break;
      }
      providerErrors.push({
        model,
        status: result.response.status,
        reason: payload?.error?.status || payload?.error?.message || 'provider_error',
      });
    }

    if (providerErrors.length) {
      console.error('maxxis-chat provider failed:', providerErrors);
      return jsonResponse({
        error: 'MAXXIS_PROVIDER_FAILED',
        message: 'Maxxis is temporarily unavailable. Please try again or contact support.',
      }, 502);
    }

    const text = String(payload?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    if (!text) {
      return jsonResponse({
        error: 'MAXXIS_EMPTY_RESPONSE',
        message: 'Maxxis could not generate a response. Please try again.',
      }, 502);
    }

    return jsonResponse({ ok: true, answer: text, language });
  } catch (err) {
    console.error('maxxis-chat failed:', err);
    return jsonResponse({ error: 'MAXXIS_FAILED', message: String((err as Error)?.message || err || 'Maxxis failed') }, 500);
  }
});
