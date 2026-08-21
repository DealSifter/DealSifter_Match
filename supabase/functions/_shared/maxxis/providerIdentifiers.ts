const PROVIDER_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function cleanProviderUuid(value: unknown) {
  const text = String(value || '').trim();
  return PROVIDER_UUID_PATTERN.test(text) ? text : '';
}
