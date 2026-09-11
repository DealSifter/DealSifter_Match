import { describe, expect, it, vi } from 'vitest';
import { PropertyDataError } from '../types.ts';
import { createRentCastClient, RENTCAST_BASE_URL } from './rentcastClient.ts';

const TEST_KEY = 'test-rentcast-key-not-real';
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe('RentCast client', () => {
  it('uses GET /v1/properties with only the encoded address and backend headers', async () => {
    const fetchImpl = vi.fn(async (_input: string | URL, _init?: RequestInit) => jsonResponse([]));
    const client = createRentCastClient({ apiKey: TEST_KEY, fetchImpl });
    await client.lookupProperty('5500 Grand Lake Dr, San Antonio, TX, 78244');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    const parsed = new URL(String(url));
    expect(`${parsed.origin}${parsed.pathname}`).toBe(`${RENTCAST_BASE_URL}/properties`);
    expect(parsed.searchParams.get('address')).toBe('5500 Grand Lake Dr, San Antonio, TX, 78244');
    expect([...parsed.searchParams.keys()]).toEqual(['address']);
    expect(String(url)).toContain('address=5500+Grand+Lake+Dr%2C+San+Antonio%2C+TX%2C+78244');
    expect(String(url)).not.toContain('5500 Grand Lake Dr');
    expect(String(url)).not.toContain(TEST_KEY);
    expect(init).toMatchObject({ method: 'GET' });
    expect(new Headers(init?.headers).get('Accept')).toBe('application/json');
    expect(new Headers(init?.headers).get('X-Api-Key')).toBe(TEST_KEY);
  });

  it.each([
    [400, 'INVALID_PROPERTY_LOOKUP'],
    [401, 'PROVIDER_AUTH_ERROR'],
    [403, 'PROVIDER_SUBSCRIPTION_ERROR'],
    [404, 'PROPERTY_NOT_FOUND'],
    [429, 'PROVIDER_RATE_LIMIT'],
    [500, 'PROVIDER_UPSTREAM_ERROR'],
    [504, 'PROVIDER_UPSTREAM_ERROR'],
  ])('maps HTTP %s to %s', async (status, code) => {
    const client = createRentCastClient({ apiKey: TEST_KEY, fetchImpl: async () => jsonResponse({}, status) });
    await expectCode(client.lookupProperty('100 Fixture St, Austin, TX, 78701'), code);
  });

  it('classifies network failure without exposing the upstream message or key', async () => {
    const client = createRentCastClient({
      apiKey: TEST_KEY,
      fetchImpl: async () => { throw new Error(`network failed ${TEST_KEY}`); },
    });
    try {
      await client.lookupProperty('100 Fixture St, Austin, TX, 78701');
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(PropertyDataError);
      expect(error).toMatchObject({ code: 'PROVIDER_NETWORK_ERROR', message: 'PROVIDER_NETWORK_ERROR' });
      expect(JSON.stringify(error)).not.toContain(TEST_KEY);
    }
  });

  it('times out predictably', async () => {
    const fetchImpl = vi.fn((_url: string | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }));
    const client = createRentCastClient({ apiKey: TEST_KEY, timeoutMs: 100, fetchImpl });
    await expectCode(client.lookupProperty('100 Fixture St, Austin, TX, 78701'), 'PROVIDER_TIMEOUT');
  });

  it('classifies invalid JSON as a billable invalid response without exposing content', async () => {
    const client = createRentCastClient({
      apiKey: TEST_KEY,
      fetchImpl: async () => new Response('not-json-secret-content', { status: 200 }),
    });
    await expect(client.lookupProperty('100 Fixture St, Austin, TX, 78701')).rejects.toMatchObject({
      code: 'INVALID_PROVIDER_RESPONSE',
      billableSuccess: true,
      httpStatus: 200,
      message: 'INVALID_PROVIDER_RESPONSE',
    });
  });

  it('rejects a non-array 200 payload', async () => {
    const client = createRentCastClient({ apiKey: TEST_KEY, fetchImpl: async () => jsonResponse({ id: 'unexpected' }) });
    await expectCode(client.lookupProperty('100 Fixture St, Austin, TX, 78701'), 'INVALID_PROVIDER_RESPONSE');
  });

  it('rejects empty input and missing configuration before network', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([]));
    expect(() => createRentCastClient({ apiKey: '', fetchImpl })).toThrow('PROVIDER_NOT_CONFIGURED');
    const client = createRentCastClient({ apiKey: TEST_KEY, fetchImpl });
    await expectCode(client.lookupProperty(''), 'INVALID_PROPERTY_LOOKUP');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
