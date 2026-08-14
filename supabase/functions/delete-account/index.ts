import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createRequestId, logOperationalEvent } from '../_shared/observability.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey =
  Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!stripeSecretKey) throw new Error('Missing STRIPE_SECRET_KEY');
if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing SUPABASE_ANON_KEY');
if (!supabaseServiceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-04-10' });
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
const USER_STORAGE_BUCKETS = ['profile-images', 'property-images'] as const;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200, requestId = '') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...(requestId ? { 'x-request-id': requestId } : {}) },
  });
}

function chunkArray<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function normalizeStoragePath(...parts: string[]) {
  return parts
    .map((part) => String(part || '').trim().replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

async function listStorageFilesRecursive(bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = [];
  const stack = [prefix];

  while (stack.length > 0) {
    const currentPrefix = stack.pop() || '';
    let offset = 0;

    for (;;) {
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .list(currentPrefix, {
          limit: 1000,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        });

      if (error) throw error;
      const entries = Array.isArray(data) ? data : [];
      if (!entries.length) break;

      for (const entry of entries) {
        const name = String(entry?.name || '').trim();
        if (!name) continue;
        const fullPath = normalizeStoragePath(currentPrefix, name);
        const isFile = Boolean(entry?.id) || Boolean(entry?.metadata?.mimetype) || Boolean(entry?.metadata?.size);
        if (isFile) files.push(fullPath);
        else stack.push(fullPath);
      }

      if (entries.length < 1000) break;
      offset += entries.length;
    }
  }

  return files;
}

async function cleanupUserStorage(userId: string) {
  const deleted: Array<{ bucket: string; path: string }> = [];
  const failed: Array<{ bucket: string; path: string; error: string }> = [];
  const listingFailures: Array<{ bucket: string; prefix: string; error: string }> = [];
  const prefix = String(userId || '').trim();

  if (!prefix) {
    return { deleted, failed, listingFailures };
  }

  for (const bucket of USER_STORAGE_BUCKETS) {
    let paths: string[] = [];
    try {
      paths = await listStorageFilesRecursive(bucket, prefix);
    } catch (err) {
      listingFailures.push({
        bucket,
        prefix,
        error: String((err as Error)?.message || err || 'Storage listing failed'),
      });
      continue;
    }

    for (const chunk of chunkArray(paths, 100)) {
      const { data, error } = await supabaseAdmin.storage.from(bucket).remove(chunk);
      const removedPaths = new Set((Array.isArray(data) ? data : [])
        .map((item) => String(item?.name || '').trim())
        .filter(Boolean));

      if (error) {
        chunk.forEach((path) => failed.push({
          bucket,
          path,
          error: String(error.message || 'Storage remove failed'),
        }));
        continue;
      }

      chunk.forEach((path) => {
        if (!removedPaths.size || removedPaths.has(path)) deleted.push({ bucket, path });
        else failed.push({ bucket, path, error: 'Storage remove did not confirm deletion' });
      });
    }
  }

  return { deleted, failed, listingFailures };
}

function getDeletionId(deletionResult: unknown) {
  if (!deletionResult || typeof deletionResult !== 'object') return '';
  const candidate = (deletionResult as Record<string, unknown>).deletionId
    || (deletionResult as Record<string, unknown>).deletion_id;
  return String(candidate || '').trim();
}

async function updateDeletionStorageAudit(
  deletionId: string,
  storageCleanup: Awaited<ReturnType<typeof cleanupUserStorage>>,
  requestId: string,
  userId: string,
) {
  if (!deletionId) return;

  const { data: deletionRow } = await supabaseAdmin
    .from('account_deletions')
    .select('metadata')
    .eq('id', deletionId)
    .single();

  const metadata = deletionRow?.metadata && typeof deletionRow.metadata === 'object'
    ? deletionRow.metadata as Record<string, unknown>
    : {};

  const cleanupMetadata = {
    policy: 'delete-public-storage-immediately',
    buckets: [...USER_STORAGE_BUCKETS],
    deleted: storageCleanup.deleted,
    failed: storageCleanup.failed,
    listingFailures: storageCleanup.listingFailures,
  };

  const { error } = await supabaseAdmin
    .from('account_deletions')
    .update({
      files_deleted: storageCleanup.deleted.length,
      files_failed: storageCleanup.failed.length + storageCleanup.listingFailures.length,
      storage_cleanup_completed_at: new Date().toISOString(),
      metadata: {
        ...metadata,
        storageCleanup: cleanupMetadata,
      },
    })
    .eq('id', deletionId);

  if (error) {
    logOperationalEvent({
      functionName: 'delete-account',
      operation: 'storage_audit_update',
      requestId,
      userId,
      success: false,
      errorCode: error.code || 'STORAGE_AUDIT_UPDATE_FAILED',
      status: 500,
      provider: 'supabase',
      severity: 'WARNING',
    });
  }
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

Deno.serve(async (req) => {
  const requestId = createRequestId(req);
  const startedAt = Date.now();
  let userId = '';
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed', requestId }, 405, requestId);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const { user, error: authError } = await getAuthenticatedUser(authHeader);
    if (authError || !user) {
      logOperationalEvent({ functionName: 'delete-account', operation: 'authenticate', requestId, durationMs: Date.now() - startedAt, success: false, errorCode: 'UNAUTHORIZED', status: 401, provider: 'supabase' });
      return jsonResponse({ error: 'Unauthorized', requestId }, 401, requestId);
    }
    userId = user.id;

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const reason = String(body.reason || 'user_requested').trim().slice(0, 240);
    const { data: subscriptionRows, error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, stripe_sub_id, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing', 'past_due']);

    if (subscriptionError) throw subscriptionError;

    const canceledStripeSubscriptions: string[] = [];
    for (const row of subscriptionRows || []) {
      const stripeSubId = String(row?.stripe_sub_id || '').trim();
      if (!stripeSubId) continue;
      try {
        await stripe.subscriptions.cancel(stripeSubId);
        canceledStripeSubscriptions.push(stripeSubId);
      } catch (err) {
        const message = String((err as Error)?.message || err || '');
        if (!message.toLowerCase().includes('already canceled')) throw err;
      }
    }

    const { data: deletionResult, error: deletionError } = await supabaseAdmin.rpc('delete_user_account', {
      target_user_id: user.id,
      p_reason: reason,
    });
    if (deletionError) throw deletionError;

    const deletionId = getDeletionId(deletionResult);
    const storageCleanup = await cleanupUserStorage(user.id);
    await updateDeletionStorageAudit(deletionId, storageCleanup, requestId, userId);

    const anonymizedAuthEmail = `deleted+${user.id}@deleted.dealsifter.local`;
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email: anonymizedAuthEmail,
      phone: null,
      user_metadata: {
        deleted: true,
        deleted_at: new Date().toISOString(),
      },
      app_metadata: {
        deleted: true,
      },
      ban_duration: '876000h',
    });

    if (authUpdateError) {
      logOperationalEvent({ functionName: 'delete-account', operation: 'anonymize_auth', requestId, userId, durationMs: Date.now() - startedAt, success: false, errorCode: 'AUTH_ANONYMIZATION_FAILED', status: 202, provider: 'supabase', severity: 'HIGH' });
      return jsonResponse({
        ok: true,
        authAnonymized: false,
        canceledStripeSubscriptions,
        deletion: deletionResult,
        storageCleanup: {
          filesDeleted: storageCleanup.deleted.length,
          filesFailed: storageCleanup.failed.length + storageCleanup.listingFailures.length,
        },
        warning: 'Account data was deleted, but authentication anonymization requires support review.',
        requestId,
      }, 202, requestId);
    }

    logOperationalEvent({ functionName: 'delete-account', operation: 'delete_account', requestId, userId, durationMs: Date.now() - startedAt, success: true, status: 200, provider: 'supabase', metrics: { files_deleted: storageCleanup.deleted.length, files_failed: storageCleanup.failed.length + storageCleanup.listingFailures.length } });
    return jsonResponse({
      ok: true,
      authAnonymized: true,
      canceledStripeSubscriptions,
      deletion: deletionResult,
      storageCleanup: {
        filesDeleted: storageCleanup.deleted.length,
        filesFailed: storageCleanup.failed.length + storageCleanup.listingFailures.length,
      },
      requestId,
    }, 200, requestId);
  } catch (err) {
    logOperationalEvent({ functionName: 'delete-account', operation: 'delete_account', requestId, userId, durationMs: Date.now() - startedAt, success: false, errorCode: 'ACCOUNT_DELETE_FAILED', status: 500, provider: 'supabase', severity: 'HIGH' });
    return jsonResponse({ error: 'Delete account failed', requestId }, 500, requestId);
  }
});
