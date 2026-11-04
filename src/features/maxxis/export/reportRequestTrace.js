/** Cryptographic UUIDv4 traces, including browsers without crypto.randomUUID. */
export function createReportRequestTrace(cryptoApi = globalThis.crypto) {
  const uuid = () => {
    if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
    if (typeof cryptoApi?.getRandomValues !== 'function') throw new Error('REPORT_TRACE_UNAVAILABLE');
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
  };
  return Object.freeze({ reportId: uuid(), requestId: uuid() });
}
