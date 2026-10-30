import { FLORIDA_POSTAL_CITIES } from './floridaPostalCities.ts';
import { PropertyDataError, type PropertyLookupInput } from './types.ts';
const cityKey = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  .replace(/\bST[.]?\b/g, 'SAINT').replace(/\bFT[.]?\b/g, 'FORT').replace(/[^A-Z0-9]/g, '');
/** Offline locality check, not a claim of street/delivery verification.
 * Outside the initial Florida scope, leave existing identity checks authoritative.
 * Unknown Florida ZIPs/aliases require correction/confirmation, never an inferred match.
 */
export function assertAddressCoherence(input: PropertyLookupInput): void {
  const zip = String(input.zipCode).slice(0, 5), floridaCities = FLORIDA_POSTAL_CITIES[zip];
  const state = String(input.state).toUpperCase();
  if (state !== 'FL' && state !== 'FLORIDA' && !floridaCities) return;
  if (!['FL', 'FLORIDA'].includes(state) || !floridaCities?.some(city => cityKey(city) === cityKey(input.city))) {
    throw new PropertyDataError('ADDRESS_CONFIRMATION_REQUIRED');
  }
}
