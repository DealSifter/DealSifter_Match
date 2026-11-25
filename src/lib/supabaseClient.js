import { createClient } from '@supabase/supabase-js';

/** @typedef {import('../types/database.types').Database} Database */
/** @typedef {import('@supabase/supabase-js').SupabaseClient<Database>} TypedSupabaseClient */

const normalizeEnvValue = (value) => String(value || '')
  .trim()
  .replace(/^['"]|['"]$/g, '')
  .replace(/[\r\n\t]/g, '')
  .trim();
const isValidHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};
const canonicalizeSupabaseUrl = (value) => {
  const raw = normalizeEnvValue(value);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[a-z0-9-]+\.supabase\.(co|in)$/i.test(raw)) return `https://${raw}`;
  return raw;
};

const readFirstEnv = (...keys) => {
  for (const key of keys) {
    const value = normalizeEnvValue(import.meta.env?.[key]);
    if (value) return value;
  }
  return '';
};

export const supabaseUrl = canonicalizeSupabaseUrl(readFirstEnv('VITE_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'));
export const supabaseAnonKey = readFirstEnv('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
const hasValidSupabaseUrl = isValidHttpUrl(supabaseUrl);
const nativeFetch = (...args) => fetch(...args);
const pendingReadRequests = new Map();
const requestSignals = new WeakMap();
let nextSignalId = 0;
let authGeneration = 0;
let sessionAccessToken;

const abortObsoleteRequest = () => new DOMException('Request belongs to an inactive authentication context.', 'AbortError');
const assertRequestContext = (generation, authorization, signal) => {
  if (signal?.aborted) throw signal.reason || new DOMException('Request aborted.', 'AbortError');
  const bearer = /^Bearer\s+(.+)$/i.exec(authorization || '')?.[1];
  if (generation !== authGeneration || (
    sessionAccessToken !== undefined && bearer && bearer !== supabaseAnonKey && bearer !== sessionAccessToken
  )) throw abortObsoleteRequest();
};

// Check both sides of body consumption: fetch may finish before logout while
// response.text()/json() (or a streamed chunk) is still pending in an SDK consumer.
const guardResponse = (response, assertCurrent) => {
  for (const method of ['json', 'text', 'blob', 'arrayBuffer', 'formData', 'bytes']) {
    if (typeof response[method] !== 'function') continue;
    const consume = response[method].bind(response);
    Object.defineProperty(response, method, { value: async (...args) => {
      assertCurrent();
      const result = await consume(...args);
      assertCurrent();
      return result;
    } });
  }
  const clone = response.clone.bind(response);
  Object.defineProperty(response, 'clone', { value: () => {
    assertCurrent();
    return guardResponse(clone(), assertCurrent);
  } });
  const body = response.body;
  if (body) {
    let stream;
    Object.defineProperty(response, 'body', { get: () => {
      assertCurrent();
      if (!stream) {
        let reader;
        stream = new ReadableStream({
          async pull(controller) {
            try {
              assertCurrent();
              reader ||= body.getReader();
              const chunk = await reader.read();
              assertCurrent();
              if (chunk.done) controller.close();
              else controller.enqueue(chunk.value);
            } catch (error) {
              controller.error(error);
              await reader?.cancel().catch(() => {});
            }
          },
          cancel: (reason) => reader ? reader.cancel(reason) : body.cancel(reason),
        }, { highWaterMark: 0 });
      }
      return stream;
    } });
  }
  return response;
};

const getRequestMethod = (input, init = {}) => {
  const method = init?.method || (typeof input === 'object' && input?.method) || 'GET';
  return String(method || 'GET').toUpperCase();
};

const getRequestUrl = (input) => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input?.url || '';
};

const isSupabaseDataRequest = (input) => {
  try {
    const url = new URL(getRequestUrl(input));
    return url.origin === new URL(supabaseUrl).origin && !url.pathname.startsWith('/auth/v1/');
  } catch {
    return false;
  }
};

const readRequestKey = async (input, init, headers, signal, generation) => {
  if (!['GET', 'HEAD'].includes(getRequestMethod(input, init)) || !globalThis.crypto?.subtle) return null;
  if (signal && !requestSignals.has(signal)) requestSignals.set(signal, ++nextSignalId);
  // Only a digest enters the transient pending map; no raw token is logged,
  // persisted, or used in a cache key. Include representation and cancellation.
  const options = ['credentials', 'mode', 'cache', 'redirect', 'referrer', 'referrerPolicy', 'integrity', 'keepalive']
    .map(name => init[name] ?? input?.[name]);
  const bytes = new TextEncoder().encode(JSON.stringify([
    getRequestMethod(input, init), getRequestUrl(input), [...headers.entries()].sort(), options,
  ]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `${generation}:${signal ? requestSignals.get(signal) : 0}:${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')}`;
};

const quotaFriendlyFetch = async (input, init = {}) => {
  if (!isSupabaseDataRequest(input)) {
    return nativeFetch(input, init);
  }

  const generation = authGeneration;
  const headers = new Headers(init.headers ?? input?.headers);
  const authorization = headers.get('authorization');
  const signal = init.signal ?? input?.signal;
  const assertCurrent = () => assertRequestContext(generation, authorization, signal);
  assertCurrent();
  const key = await readRequestKey(input, init, headers, signal, generation);
  assertCurrent();
  let pending = key && pendingReadRequests.get(key);
  if (!pending) {
    pending = nativeFetch(input, init);
    if (key) {
      pending = pending.finally(() => {
        if (pendingReadRequests.get(key) === pending) pendingReadRequests.delete(key);
      });
      pendingReadRequests.set(key, pending);
    }
  }
  let response;
  try {
    response = await pending;
  } catch (error) {
    // Preserve current-session errors/retries, but never let an SDK retry an
    // obsolete operation with credentials captured before the session changed.
    assertCurrent();
    throw error;
  }
  assertCurrent();
  return guardResponse(key ? response.clone() : response, assertCurrent);
};

export const isSupabaseConfigured = Boolean(hasValidSupabaseUrl && supabaseAnonKey);
export const supabaseConfigReason = hasValidSupabaseUrl
  ? (supabaseAnonKey ? '' : 'VITE_SUPABASE_ANON_KEY ausente')
  : (supabaseUrl ? `VITE_SUPABASE_URL inválida: ${supabaseUrl}` : 'VITE_SUPABASE_URL ausente');

/** Dev-only hint when env vars were not injected at build time (common on Vercel). */
export const supabaseConfigHint = isSupabaseConfigured
  ? null
  : `Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel e faca Redeploy. (${supabaseConfigReason})`;

/** @type {TypedSupabaseClient | null} */
let supabase = null;
if (isSupabaseConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        fetch: quotaFriendlyFetch,
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    // Registered before UI consumers; synchronous callback avoids Auth lock work.
    supabase.auth.onAuthStateChange((event, session) => {
      if (!session && !['INITIAL_SESSION', 'SIGNED_OUT', 'USER_DELETED'].includes(event)) return;
      const token = session?.access_token || null;
      if (token !== sessionAccessToken || ['SIGNED_OUT', 'USER_DELETED', 'USER_UPDATED', 'MFA_CHALLENGE_VERIFIED'].includes(event)) {
        sessionAccessToken = token;
        authGeneration += 1;
        pendingReadRequests.clear();
      }
    });
  } catch {
    supabase = null;
  }
}

export { supabase };

export const invokeSupabaseFunction = async (functionName, options = {}) => {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured.') };
  return supabase.functions.invoke(functionName, options);
};

export const getSupabaseFunctionUrl = (functionName) => (
  supabaseUrl && functionName
    ? `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/${String(functionName).replace(/^\/+/, '')}`
    : ''
);
