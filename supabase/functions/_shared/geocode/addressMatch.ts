type Input = { address?: string; city?: string; state?: string; zip?: string };
const abbreviations: Record<string, string> = { street: 'st', avenue: 'ave', road: 'rd', drive: 'dr', court: 'ct', lane: 'ln', boulevard: 'blvd', place: 'pl', circle: 'cir', terrace: 'ter', north: 'n', south: 's', east: 'e', west: 'w' };
const normalize = (value: unknown) => String(value ?? '').toLowerCase().replace(/[.,]/g, '').trim().split(/\s+/).map(token => abbreviations[token] || token).join(' ');
export function addressMatches(input: Input, match: Input): boolean {
  if (!input.address || !input.city || !input.state || !input.zip) return false;
  return normalize(input.address) === normalize(match.address)
    && normalize(input.city) === normalize(match.city)
    && normalize(input.state) === normalize(match.state)
    && String(input.zip).slice(0, 5) === String(match.zip ?? '').slice(0, 5);
}
export function censusAddressMatches(input: Input, matchedAddress: unknown): boolean {
  const parts = String(matchedAddress ?? '').split(',').map(part => part.trim());
  if (parts.length !== 4) return false;
  return addressMatches(input, { address: parts[0], city: parts[1], state: parts[2], zip: parts[3] });
}
