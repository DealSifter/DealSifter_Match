// Sending follows the owner's selected identity, never the last form opened by default.
export function resolveReportSenderScope({ accountType, professionalProfile = {}, personalProfile = {}, selectedScope } = {}) {
  const scopes = accountType === 'fsbo_owner' ? ['fsbo', 'professional'] : ['personal', 'professional'];
  if (scopes.includes(selectedScope)) return selectedScope;
  const priorities = {
    personal: professionalProfile.cardPriorityA,
    professional: professionalProfile.cardPriorityB,
    fsbo: personalProfile.cardPriorityC || professionalProfile.cardPriorityC,
  };
  return scopes.find(scope => String(priorities[scope] || '').toLowerCase() === 'primary') || scopes[0];
}
