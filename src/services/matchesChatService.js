import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getChatAccessStatus({ owner, senderCanChat, localAcceptsChat }) {
  if (!owner) return { canChat: false, reason: 'missing_contact' };
  if (!senderCanChat) return { canChat: false, reason: 'sender_plan' };

  const ownerId = String(owner.id || owner.ownerId || owner.unlockOwnerId || '').trim();
  if (isSupabaseConfigured && supabase && UUID_RE.test(ownerId)) {
    const { data, error } = await supabase.rpc('ds_get_chat_contact_status', {
      p_contact_owner_id: ownerId,
      p_primary_profile: owner.primaryProfile || null,
    });
    if (error) throw error;
    const status = data && typeof data === 'object' ? data : {};
    if (status.canChat === false) {
      return {
        canChat: false,
        reason: status.acceptsChat === false
          ? 'contact_method'
          : (status.senderCanChat === false ? 'sender_plan' : 'recipient_plan'),
        ...status,
      };
    }
    return { canChat: true, reason: null, ...status };
  }

  return localAcceptsChat
    ? { canChat: true, reason: null }
    : { canChat: false, reason: 'contact_method', acceptsChat: false };
}
