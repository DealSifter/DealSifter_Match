import { test, expect } from '../../fixtures/realBackendFixture.js';

const forbiddenKeys = /(email|phone|mobile|cellphone|whatsapp|contact_methods|contactMethods|raw_profile_payload|unlock_id|intent_token)/i;

function collectForbiddenKeys(value, path = '', matches = []) {
  if (!value || typeof value !== 'object') return matches;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenKeys(item, `${path}[${index}]`, matches));
    return matches;
  }
  Object.entries(value).forEach(([key, child]) => {
    const nextPath = path ? `${path}.${key}` : key;
    if (forbiddenKeys.test(key)) matches.push(nextPath);
    collectForbiddenKeys(child, nextPath, matches);
  });
  return matches;
}

function assertNoFixtureSecrets(payload, realBackend) {
  const text = JSON.stringify(payload);
  expect(text).not.toContain(realBackend.investor.email);
  expect(text).not.toContain(realBackend.owner.email);
  expect(text).not.toContain(realBackend.provider.email);
  expect(text).not.toContain('+12145550101');
  expect(text).not.toContain('+12145550102');
  expect(text).not.toContain('+12145550103');
  expect(text).not.toContain(`123 ${realBackend.runId} Private Street`);
  expect(text).not.toContain('32.7767');
  expect(text).not.toContain('-96.797');
}

test('real feed/privacy, Maxxis property/provider tools and prepare+cancel unlock are safe', async ({ page, realBackend }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const investorSession = await realBackend.signIn(realBackend.investor.email, realBackend.investor.password);
  const token = investorSession.access_token;

  const feed = await realBackend.browserRpc(page, {
    token,
    fn: 'ds_get_global_feed_inventory',
  });
  expect(feed.ok, JSON.stringify(feed.payload)).toBe(true);
  const fixtureProperty = feed.payload.properties.find((item) => item.id === realBackend.property.id);
  const fixtureService = feed.payload.services.find((item) => item.id === realBackend.service.id);
  expect(fixtureProperty).toBeTruthy();
  expect(fixtureService).toBeTruthy();
  expect(fixtureProperty.address).toBeNull();
  expect(fixtureProperty.lat).toBeNull();
  expect(fixtureProperty.lng).toBeNull();
  assertNoFixtureSecrets(feed.payload, realBackend);
  expect(collectForbiddenKeys(feed.payload)).toEqual([]);

  const publicDetails = await realBackend.browserRpc(page, {
    token,
    fn: 'ds_get_public_property_details',
    body: { p_property_id: realBackend.property.id },
  });
  expect(publicDetails.ok, JSON.stringify(publicDetails.payload)).toBe(true);
  expect(publicDetails.payload).toHaveLength(1);
  expect(publicDetails.payload[0].id).toBe(realBackend.property.id);
  expect(publicDetails.payload[0].images).toHaveLength(1);
  ['owner_id', 'address', 'lat', 'lng', 'email', 'phone', 'whatsapp', 'profile_payload', 'unlock_id']
    .forEach((field) => expect(publicDetails.payload[0]).not.toHaveProperty(field));
  assertNoFixtureSecrets(publicDetails.payload, realBackend);

  for (const property of [realBackend.hiddenProperty, realBackend.inactiveProperty, realBackend.closedProperty]) {
    const unavailable = await realBackend.browserRpc(page, {
      token,
      fn: 'ds_get_public_property_details',
      body: { p_property_id: property.id },
    });
    expect(unavailable.ok, JSON.stringify(unavailable.payload)).toBe(true);
    expect(unavailable.payload).toEqual([]);
  }

  const maxxisDetails = await realBackend.invokeFunction({
    token,
    name: 'maxxis-chat',
    body: {
      message: 'Show property details and professionals for this property',
      page: 'property-details',
      language: 'en',
      context: { propertyId: realBackend.property.id },
    },
  });
  expect(maxxisDetails.ok, JSON.stringify(maxxisDetails.payload)).toBe(true);
  expect(maxxisDetails.payload.type).toBe('property_details');
  expect(maxxisDetails.payload.data.property.id).toBe(realBackend.property.id);
  expect(maxxisDetails.payload.data.serviceMatches).toBeTruthy();
  expect(JSON.stringify(maxxisDetails.payload.data.serviceMatches)).toContain(realBackend.service.id);
  assertNoFixtureSecrets(maxxisDetails.payload, realBackend);

  const maxxisSearch = await realBackend.invokeFunction({
    token,
    name: 'maxxis-chat',
    body: { message: 'Find properties in Dallas Texas', page: 'feed', language: 'en' },
  });
  expect(maxxisSearch.ok, JSON.stringify(maxxisSearch.payload)).toBe(true);
  expect(maxxisSearch.payload.type).toBe('properties');
  expect(maxxisSearch.payload.data.properties.some((item) => item.id === realBackend.property.id)).toBe(true);
  expect(maxxisSearch.payload.data.properties.some((item) => item.id === realBackend.hiddenProperty.id)).toBe(false);
  assertNoFixtureSecrets(maxxisSearch.payload, realBackend);

  const dealCopilot = await realBackend.invokeFunction({
    token,
    name: 'maxxis-chat',
    body: {
      message: 'Show the Deal Copilot overall deal status',
      page: 'property-details',
      language: 'en',
      context: { propertyId: realBackend.property.id },
    },
  });
  expect(dealCopilot.ok, JSON.stringify(dealCopilot.payload)).toBe(true);
  expect(dealCopilot.payload.type).toBe('deal_copilot_overview');
  expect(dealCopilot.payload.data.propertySummary.id).toBe(realBackend.property.id);
  assertNoFixtureSecrets(dealCopilot.payload, realBackend);

  const maxxisServices = await realBackend.invokeFunction({
    token,
    name: 'maxxis-chat',
    body: {
      message: 'Find a Dallas contractor service provider',
      page: 'feed',
      language: 'en',
    },
  });
  expect(maxxisServices.ok, JSON.stringify(maxxisServices.payload)).toBe(true);
  expect(maxxisServices.payload.type).toBe('services');
  expect(maxxisServices.payload.data.services.some((item) => item.id === realBackend.service.id)).toBe(true);
  assertNoFixtureSecrets(maxxisServices.payload, realBackend);

  const beforeUsers = await realBackend.adminSelect('users', `select=nuggets&id=eq.${realBackend.investor.id}`);
  expect(beforeUsers).toHaveLength(1);

  const prepare = await realBackend.invokeFunction({
    token,
    name: 'maxxis-provider-unlock-prepare',
    body: { serviceId: realBackend.service.id },
  });
  expect(prepare.ok, JSON.stringify(prepare.payload)).toBe(true);
  expect(prepare.payload.success).toBe(true);
  expect(prepare.payload.status).toBe('locked');
  expect(prepare.payload.action.intentToken).toBeTruthy();
  expect(prepare.payload.action.cost).toBeGreaterThanOrEqual(0);
  assertNoFixtureSecrets(prepare.payload, realBackend);

  const cancel = await realBackend.invokeFunction({
    token,
    name: 'maxxis-provider-unlock-cancel',
    body: { intentToken: prepare.payload.action.intentToken },
  });
  expect(cancel.ok, JSON.stringify(cancel.payload)).toBe(true);
  expect(cancel.payload.success).toBe(true);

  const afterUsers = await realBackend.adminSelect('users', `select=nuggets&id=eq.${realBackend.investor.id}`);
  expect(afterUsers).toHaveLength(1);
  expect(afterUsers[0].nuggets).toBe(beforeUsers[0].nuggets);

  const unlockRows = await realBackend.adminSelect('unlocks', `select=id&buyer_id=eq.${realBackend.investor.id}&seller_id=eq.${realBackend.provider.id}`);
  expect(unlockRows).toEqual([]);

  const accessAfterCancel = await realBackend.browserRpc(page, {
    token,
    fn: 'ds_get_provider_contact_access',
    body: { p_service_ids: [realBackend.service.id] },
  });
  expect(accessAfterCancel.ok, JSON.stringify(accessAfterCancel.payload)).toBe(true);
  expect(accessAfterCancel.payload[0].status).toBe('locked');
  assertNoFixtureSecrets(accessAfterCancel.payload, realBackend);
});

test('real RLS and protected Edge Functions reject cross-account or anonymous access', async ({ page, realBackend }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const providerSession = await realBackend.signIn(realBackend.provider.email, realBackend.provider.password);
  const providerToken = providerSession.access_token;

  // user_profiles is the deliberately public identity card. Its legitimate public
  // contract is limited to id/user_id, name, photo, bio, visibility and timestamps.
  const otherProfile = await realBackend.browserRestSelect(page, {
    token: providerToken,
    table: 'user_profiles',
    query: `select=*&user_id=eq.${realBackend.investor.id}`,
  });
  expect(otherProfile.ok, JSON.stringify(otherProfile.payload)).toBe(true);
  expect(otherProfile.payload).toHaveLength(1);
  expect(Object.keys(otherProfile.payload[0]).sort()).toEqual([
    'bio', 'created_at', 'full_name', 'id', 'photo_url', 'updated_at', 'user_id', 'visibility',
  ]);
  expect(collectForbiddenKeys(otherProfile.payload)).toEqual([]);
  assertNoFixtureSecrets(otherProfile.payload, realBackend);

  const otherProfessionalProfile = await realBackend.browserRestSelect(page, {
    token: providerToken,
    table: 'professional_profiles',
    query: `select=user_id,profile_payload&user_id=eq.${realBackend.investor.id}`,
  });
  expect(otherProfessionalProfile.ok, JSON.stringify(otherProfessionalProfile.payload)).toBe(true);
  expect(otherProfessionalProfile.payload).toEqual([]);

  const otherPropertyBaseRow = await realBackend.browserRestSelect(page, {
    token: providerToken,
    table: 'properties',
    query: `select=id,address,lat,lng&owner_id=eq.${realBackend.owner.id}`,
  });
  expect(otherPropertyBaseRow.ok, JSON.stringify(otherPropertyBaseRow.payload)).toBe(true);
  expect(otherPropertyBaseRow.payload).toEqual([]);

  const otherPropertyImages = await realBackend.browserRestSelect(page, {
    token: providerToken,
    table: 'property_images',
    query: `select=id,image_url,property_id&property_id=eq.${realBackend.property.id}`,
  });
  expect(otherPropertyImages.ok, JSON.stringify(otherPropertyImages.payload)).toBe(true);
  expect(otherPropertyImages.payload).toEqual([]);

  const ownerSession = await realBackend.signIn(realBackend.owner.email, realBackend.owner.password);
  const ownerRows = await realBackend.browserRestSelect(page, {
    token: ownerSession.access_token,
    table: 'properties',
    query: `select=id,address&owner_id=eq.${realBackend.owner.id}`,
  });
  expect(ownerRows.ok, JSON.stringify(ownerRows.payload)).toBe(true);
  expect(ownerRows.payload.some((row) => row.id === realBackend.property.id && row.address)).toBe(true);

  const ownerPublicDetails = await realBackend.browserRpc(page, {
    token: ownerSession.access_token,
    fn: 'ds_get_public_property_details',
    body: { p_property_id: realBackend.property.id },
  });
  expect(ownerPublicDetails.ok, JSON.stringify(ownerPublicDetails.payload)).toBe(true);
  expect(ownerPublicDetails.payload).toHaveLength(1);
  expect(ownerPublicDetails.payload[0]).not.toHaveProperty('address');

  const anonymousDetails = await realBackend.browserRpc(page, {
    token: '',
    fn: 'ds_get_public_property_details',
    body: { p_property_id: realBackend.property.id },
  });
  expect([401, 403]).toContain(anonymousDetails.status);

  const anonymousPrepare = await realBackend.invokeFunction({
    token: '',
    name: 'maxxis-provider-unlock-prepare',
    body: { serviceId: realBackend.service.id },
  });
  expect(anonymousPrepare.status).toBe(401);

  const authorizedPrepare = await realBackend.invokeFunction({
    token: providerToken,
    name: 'maxxis-provider-unlock-prepare',
    body: { serviceId: realBackend.service.id },
  });
  expect(authorizedPrepare.status).toBe(404);
  expect(authorizedPrepare.payload.error).toBe('PROVIDER_UNAVAILABLE');
});
