export const guideTipsEnabledKey = (userId) => `ds_guidetips_enabled:${String(userId || 'guest')}`;

export function resolveGuideTipsActivation({
  canStart = false,
  hasValidProfile = false,
  manuallyEnabled = false,
  isAuthenticated = false,
  isProtectedSurface = true,
  sessionDismissed = false,
  pageTour = 'feed',
} = {}) {
  const eligible = Boolean(canStart && isAuthenticated && isProtectedSurface);
  const mandatory = Boolean(eligible && !hasValidProfile);
  return {
    mandatory,
    enabled: Boolean(eligible && !sessionDismissed && (mandatory || manuallyEnabled)),
    activeTour: mandatory ? 'initial' : pageTour,
  };
}
