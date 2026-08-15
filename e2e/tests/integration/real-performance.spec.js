import { test, expect } from '../../fixtures/realBackendFixture.js';

const CONCURRENCY = 6;

function percentile(values, quantile) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)] || 0;
}

function summarize(name, responses, goodThresholdMs = 2000) {
  const durations = responses.map((response) => Number(response.durationMs || 0));
  const p50Ms = Number(percentile(durations, 0.5).toFixed(1));
  const p95Ms = Number(percentile(durations, 0.95).toFixed(1));
  const p99Ms = Number(percentile(durations, 0.99).toFixed(1));
  const payloadP95Bytes = percentile(responses.map((response) => Number(response.payloadBytes || 0)), 0.95);
  const classification = p95Ms <= goodThresholdMs ? 'GOOD' : p95Ms <= goodThresholdMs * 2 ? 'WATCH' : 'NEEDS_OPTIMIZATION';
  const summary = { name, concurrency: CONCURRENCY, p50Ms, p95Ms, p99Ms, payloadP95Bytes, classification };
  console.log(`[performance-load] ${JSON.stringify(summary)}`);
  return summary;
}

test('controlled staging read load remains functionally safe and reports latency', async ({ page, realBackend }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const session = await realBackend.signIn(realBackend.investor.email, realBackend.investor.password);
  const token = session.access_token;

  const propertySearch = await Promise.all(Array.from({ length: CONCURRENCY }, () => realBackend.browserRpc(page, {
    token,
    fn: 'ds_search_public_properties',
    body: { p_state: ['TX'], p_city: 'Dallas', p_limit: 10 },
  })));
  const propertyDetails = await Promise.all(Array.from({ length: CONCURRENCY }, () => realBackend.browserRpc(page, {
    token,
    fn: 'ds_get_public_property_details',
    body: { p_property_id: realBackend.property.id },
  })));
  const feed = await Promise.all(Array.from({ length: CONCURRENCY }, () => realBackend.browserRpc(page, {
    token,
    fn: 'ds_get_global_feed_inventory',
  })));

  for (const responses of [propertySearch, propertyDetails, feed]) {
    expect(responses.every((response) => response.ok)).toBe(true);
  }
  expect(propertySearch.every((response) => response.payload.some((item) => item.id === realBackend.property.id))).toBe(true);
  expect(propertyDetails.every((response) => response.payload[0]?.id === realBackend.property.id)).toBe(true);
  expect(feed.every((response) => response.payload.properties.some((item) => item.id === realBackend.property.id))).toBe(true);

  summarize('property_search', propertySearch);
  summarize('property_details', propertyDetails);
  summarize('global_feed', feed);
});

test('Maxxis staging separates first-observed and warm tool latency', async ({ realBackend }) => {
  const session = await realBackend.signIn(realBackend.investor.email, realBackend.investor.password);
  const token = session.access_token;
  const responses = [];
  for (let index = 0; index < 3; index += 1) {
    responses.push(await realBackend.invokeFunction({
      token,
      name: 'maxxis-chat',
      body: { message: 'Find a Dallas contractor service provider', page: 'feed', language: 'en' },
    }));
  }

  responses.forEach((response) => {
    expect(response.ok, JSON.stringify(response.payload)).toBe(true);
    expect(response.payload.type).toBe('services');
    expect(response.payload.data.services.some((item) => item.id === realBackend.service.id)).toBe(true);
  });
  console.log(`[performance-load] ${JSON.stringify({
    name: 'maxxis_service_search',
    firstObservedMs: Number(responses[0].durationMs.toFixed(1)),
    warmP50Ms: Number(percentile(responses.slice(1).map((response) => response.durationMs), 0.5).toFixed(1)),
    warmP95Ms: Number(percentile(responses.slice(1).map((response) => response.durationMs), 0.95).toFixed(1)),
    payloadP95Bytes: percentile(responses.map((response) => response.payloadBytes), 0.95),
  })}`);
});
