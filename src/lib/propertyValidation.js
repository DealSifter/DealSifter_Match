function parseCurrencyInput(value) {
  const normalized = String(value || '').replace(/,/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

export function validateFsboPropertyDraft(draft) {
  if (!String(draft.address || '').trim() || !String(draft.city || '').trim() || !String(draft.price || '').trim()) {
    return { valid: false, reason: 'missing_required' };
  }

  const price = parseCurrencyInput(draft.price);
  if (!Number.isFinite(price) || price <= 0) {
    return { valid: false, reason: 'invalid_price' };
  }

  return { valid: true, reason: null, parsedPrice: price };
}

export function validateProfessionalPropertyDraft(draft) {
  if (!String(draft.address || '').trim() || !String(draft.city || '').trim() || !String(draft.price || '').trim()) {
    return { valid: false, reason: 'missing_required' };
  }

  const price = parseCurrencyInput(draft.price);
  if (!Number.isFinite(price) || price <= 0) {
    return { valid: false, reason: 'invalid_price' };
  }

  if (!String(draft.primaryProfileScope || '').trim()) {
    return { valid: false, reason: 'missing_primary_profile' };
  }

  return { valid: true, reason: null, parsedPrice: price };
}
