export function propertyIntelligenceExposed(getEnv: (name: string) => string | undefined, userId: string) {
  // 1D-CORE: visible LOCKED is inert. Public exposure NEVER grants evidence access.
  if (!getEnv('PROPERTY_INTELLIGENCE_EXPOSURE') || getEnv('PROPERTY_INTELLIGENCE_EXPOSURE') === 'public') return true;
  if (getEnv('PROPERTY_INTELLIGENCE_EXPOSURE') !== 'allowlist' || !userId) return false;
  return (getEnv('PROPERTY_INTELLIGENCE_ALLOWED_USER_IDS') || '').split(',').map(x => x.trim()).includes(userId);
}
