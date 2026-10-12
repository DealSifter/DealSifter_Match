// Reuse MapView's session preference document. This is not authorization;
// the server-derived eligibility boolean is always required for visualization.
export function restoreParcelPreference(state, userId) {
  return { owner: String(userId || ''), enabled: !!userId && state?.parcelPreferenceOwner === String(userId)
    && state?.publicParcelBoundariesEnabled === true };
}

export function parcelPreferenceEnabled(preference, userId, eligible) {
  return eligible === true && !!userId && preference?.owner === String(userId) && preference?.enabled === true;
}
