import { test, expect } from '../../fixtures/realBackendFixture.js';

const FUNNEL = [
  'property_viewed',
  'deal_copilot_opened',
  'provider_suggested',
  'provider_unlock_started',
  'provider_unlocked',
  'provider_message_sent',
  'provider_reply_received',
];

test('staging feature flags are authenticated, deterministic and fail closed', async ({ realBackend }) => {
  const anonymous = await realBackend.invokeFunction({ name: 'feature-flags' });
  expect(anonymous.status).toBe(401);

  const session = await realBackend.signIn(realBackend.investor.email, realBackend.investor.password);
  const first = await realBackend.invokeFunction({ token: session.access_token, name: 'feature-flags' });
  const second = await realBackend.invokeFunction({ token: session.access_token, name: 'feature-flags' });
  expect(first.ok, JSON.stringify(first.payload)).toBe(true);
  expect(first.payload.environment).toBe('staging');
  expect(first.payload.flags.platform_readiness_probe).toBe(true);
  expect(first.payload.flags.maxxis_next_generation).toBe(false);
  expect(second.payload.flags).toEqual(first.payload.flags);

  const overridden = await realBackend.invokeFunction({
    token: session.access_token,
    name: 'feature-flags',
    body: { overrides: { platform_readiness_probe: false, hidden_client_bypass: true } },
  });
  expect(overridden.ok, JSON.stringify(overridden.payload)).toBe(true);
  expect(overridden.payload.flags.platform_readiness_probe).toBe(false);
  expect(overridden.payload.flags.hidden_client_bypass).toBeUndefined();
});

test('privacy-safe Maxxis Deal AI funnel events are observable in staging', async ({ page, realBackend }) => {
  const session = await realBackend.signIn(realBackend.investor.email, realBackend.investor.password);
  const entityId = `readiness-${realBackend.runId}`.slice(0, 96);
  for (const eventName of FUNNEL) {
    const tracked = await realBackend.browserRpc(page, {
      token: session.access_token,
      fn: 'track_app_event',
      body: {
        p_event_type: eventName,
        p_entity_type: 'readiness_probe',
        p_entity_id: entityId,
        p_value_nuggets: 0,
        p_value_usd_cents: 0,
        p_metadata: { taxonomy_version: 1, funnel_step: eventName },
      },
    });
    expect(tracked.ok, JSON.stringify(tracked.payload)).toBe(true);
  }

  await expect.poll(async () => {
    const events = await realBackend.adminSelect(
      'app_events',
      `select=event_type,entity_id,metadata&user_id=eq.${realBackend.investor.id}&entity_id=eq.${entityId}`,
    );
    return events.map((event) => event.event_type).sort();
  }).toEqual([...FUNNEL].sort());

  const events = await realBackend.adminSelect(
    'app_events',
    `select=event_type,entity_id,metadata&user_id=eq.${realBackend.investor.id}&entity_id=eq.${entityId}`,
  );
  expect(JSON.stringify(events)).not.toMatch(/email|phone|whatsapp|address|message_body|prompt|stripe|payment|secret/i);
});
