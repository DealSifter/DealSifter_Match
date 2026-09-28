export const SPOTLIGHT_NUGGET_COST = 10;

export function isInsufficientSpotlightBalanceError(error) {
  const code = String(error?.code || '').trim();
  const message = String(error?.message || error?.details || error?.detail || error || '').toLowerCase();
  return code === '22003'
    || message.includes('not enough nuggets')
    || message.includes('insufficient_nuggets');
}

export async function purchaseCardSpotlights({ supabaseClient, userId, items = [] } = {}) {
  if (!supabaseClient?.rpc || !userId) {
    throw new Error('Supabase session required to activate paid spotlights.');
  }

  const selected = (items || []).filter((item) => item?.cardKind && item?.cardId);
  if (!selected.length) {
    return { rows: [], remainingNuggets: null, totalCost: 0 };
  }

  const payload = selected.map((item) => ({
    cardKind: item.cardKind,
    cardId: item.cardId,
    ownerId: userId,
    scope: item.scope || '',
    metadata: {
      source: 'spotlight_modal',
      title: String(item.title || '').slice(0, 120),
    },
  }));
  const { data, error } = await supabaseClient.rpc('ds_purchase_card_spotlights', { p_items: payload });
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  const remainingNuggets = Number(rows[0]?.remaining_nuggets);
  if (!rows.length || !Number.isFinite(remainingNuggets)) {
    throw new Error('Spotlight purchase did not return the confirmed server balance.');
  }

  return {
    rows,
    remainingNuggets,
    totalCost: selected.length * SPOTLIGHT_NUGGET_COST,
  };
}
