export function formatPropertyLocation(property = {}) {
  const city = String(property.city || '').trim();
  const state = String(property.state || (Array.isArray(property.markets) ? property.markets[0] : '') || '').trim().toUpperCase();
  const zip = String(property.zip || '').trim();
  const cityAlreadyHasState = /\b[A-Z]{2}\b/.test(city);
  const cityAlreadyHasZip = zip && city.includes(zip);

  let location = city;
  if (state && !cityAlreadyHasState) {
    location = location ? `${location}, ${state}` : state;
  }
  if (zip && !cityAlreadyHasZip) {
    location = location ? `${location} ${zip}` : zip;
  }

  return location;
}
