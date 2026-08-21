import { describe, expect, it } from 'vitest';
import { cleanProviderUuid } from './providerIdentifiers.ts';

const validServiceId = '3a349237-2dab-40dd-82b8-43a047310aeb';
const validPropertyId = 'b074f9d2-54b4-484b-b64d-dd9586077ac5';

describe('provider identifier parity', () => {
  it('accepts standard service and property UUIDs used by unlock and messaging', () => {
    expect(cleanProviderUuid(validServiceId)).toBe(validServiceId);
    expect(cleanProviderUuid(`  ${validPropertyId}  `)).toBe(validPropertyId);
  });

  it('rejects malformed identifiers without relaxing the UUID contract', () => {
    expect(cleanProviderUuid('not-a-uuid')).toBe('');
    expect(cleanProviderUuid('3a349237-2dab-40dd-82b8')).toBe('');
    expect(cleanProviderUuid({ id: validServiceId })).toBe('');
  });
});
