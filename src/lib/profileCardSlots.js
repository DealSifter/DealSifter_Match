const PROFILE_KEYS = ['personal', 'secondary', 'fsbo'];

export function resolveProfileCardSlots(priorityByProfileKey = {}, registeredProfileKeys = []) {
  const registered = new Set(registeredProfileKeys);
  const findByPriority = (priority) => PROFILE_KEYS.find(
    (profileKey) => String(priorityByProfileKey?.[profileKey] || '').trim().toLowerCase() === priority
  ) || null;

  const explicitPrimaryProfileKey = findByPriority('primary');
  const fallbackPrimaryProfileKey = PROFILE_KEYS.find((profileKey) => registered.has(profileKey)) || null;
  const primaryProfileKey = explicitPrimaryProfileKey || fallbackPrimaryProfileKey;
  const secondaryCandidate = findByPriority('secondary');
  const secondaryProfileKey = secondaryCandidate && secondaryCandidate !== primaryProfileKey
    ? secondaryCandidate
    : null;

  return {
    explicitPrimaryProfileKey,
    primaryProfileKey,
    secondaryProfileKey,
  };
}
