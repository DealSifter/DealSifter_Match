const truthyFlag = (value, fallback = false) => {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const raw = String(value).trim().toLowerCase();
  if (['false', '0', 'off', 'no', 'nao', 'não'].includes(raw)) return false;
  if (['true', '1', 'on', 'yes', 'sim'].includes(raw)) return true;
  return fallback;
};

export const shouldHideStreetAddressOnCard = (property) => truthyFlag(
  property?.hideStreetAddressOnCard ?? property?.hide_street_address_on_card,
  false
);

export const getPublicPropertyAddressLine = (property) => {
  const fullAddress = String(property?.address || '').trim();
  if (!shouldHideStreetAddressOnCard(property)) return fullAddress;
  return '';
};

export const getBlurredStreetAddressLine = (property) => String(property?.address || '').trim();

export default {
  getBlurredStreetAddressLine,
  getPublicPropertyAddressLine,
  shouldHideStreetAddressOnCard,
};
