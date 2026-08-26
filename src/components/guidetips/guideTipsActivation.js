export const guideTipsEnabledKey = (userId) => `ds_guidetips_enabled:${String(userId || 'guest')}`;

export function resolveGuideTipsActivation({
  canStart = false,
  hasValidProfile = false,
  manuallyEnabled = false,
  pageTour = 'feed',
} = {}) {
  const mandatory = Boolean(canStart && !hasValidProfile);
  return {
    mandatory,
    enabled: Boolean(mandatory || manuallyEnabled),
    activeTour: mandatory ? 'initial' : pageTour,
  };
}
