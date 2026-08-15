/* global process */
import { test as base, expect } from '@playwright/test';
import { getE2ERunId } from '../support/environment.js';
import { loginAs, logout } from '../support/appActions.js';

const supabaseUrl = process.env.E2E_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.E2E_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const runId = getE2ERunId();

const publicEnv = {
  supabaseUrl,
  anonKey,
};

const passwordForRun = () => `E2e-${runId}-Aa1!`.replace(/[^a-zA-Z0-9!_-]/g, '-');

function userEmail(role) {
  return `e2e-${runId}-${role}@example.invalid`.toLowerCase();
}

function makeProfilePayload({ name, email, phone, role = 'professional' }) {
  const investmentProfile = {
    markets: ['Texas', 'Dallas'],
    states: ['TX'],
    cities: ['Dallas'],
    propertyTypes: ['Single Family'],
    maxArv: 500000,
    minimumMarginPercent: 20,
    funding: 'Cash Only',
    closingTimeline: '< 14 days',
    summary: 'I buy Texas, Dallas, Single Family, ARV up to 500k, minimum 20% margin, cash only, closing under 14 days.',
  };
  const contact = {
    name,
    email,
    phone,
    phonePrimary: phone,
    whatsapp: phone,
    contactMethods: ['email', 'phone', 'whatsapp'],
    location: 'Dallas, TX',
  };
  return {
    version: 1,
    accountType: role,
    profiles: {
      personal: { displayName: name },
      professional: {
        companyName: `${name} LLC`,
        investmentProfile,
        contact,
      },
      fsbo: {
        displayName: name,
        contact,
      },
    },
    resolved: {
      personal: contact,
      professional: contact,
      fsbo: contact,
    },
    legacy: {
      professionalProfile: { investmentProfile, ...contact },
      personalProfile: contact,
    },
  };
}

async function parseResponse(response) {
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok) {
    throw new Error(`Supabase request failed ${response.status}: ${text}`);
  }
  return { response, payload };
}

async function adminFetch(path, { method = 'GET', body, headers = {} } = {}) {
  return parseResponse(await fetch(`${supabaseUrl}${path}`, {
    method,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}

async function restUpsert(table, rows, conflictColumn) {
  await adminFetch(`/rest/v1/${table}?on_conflict=${conflictColumn}`, {
    method: 'POST',
    body: rows,
    headers: { Prefer: 'resolution=merge-duplicates' },
  });
}

async function restInsertReturning(table, row) {
  const { payload } = await adminFetch(`/rest/v1/${table}?select=id`, {
    method: 'POST',
    body: row,
    headers: { Prefer: 'return=representation' },
  });
  return Array.isArray(payload) ? payload[0] : payload;
}

async function createAuthUser(role) {
  const email = userEmail(role);
  const password = passwordForRun();
  const { payload } = await adminFetch('/auth/v1/admin/users', {
    method: 'POST',
    body: {
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `E2E ${role} ${runId}` },
    },
  });
  return { id: payload.id, email, password, name: `E2E ${role} ${runId}` };
}

async function upsertFixtureRows(fixture) {
  const users = [
    { id: fixture.investor.id, email: fixture.investor.email, full_name: fixture.investor.name, phone: '+12145550101', account_type: 'professional', is_admin: false, nuggets: 100, plan_id: 'pro', deleted_at: null },
    { id: fixture.owner.id, email: fixture.owner.email, full_name: fixture.owner.name, phone: '+12145550102', account_type: 'fsbo_owner', is_admin: false, nuggets: 0, plan_id: 'free', deleted_at: null },
    { id: fixture.provider.id, email: fixture.provider.email, full_name: fixture.provider.name, phone: '+12145550103', account_type: 'professional', is_admin: false, nuggets: 0, plan_id: 'free', deleted_at: null },
  ];
  await restUpsert('users', users, 'id');

  const personalProfiles = users.map((user) => ({
    user_id: user.id,
    full_name: user.full_name,
    bio: `${runId} fixture public bio`,
    visibility: 'public',
    photo_url: '',
  }));
  await restUpsert('user_profiles', personalProfiles, 'user_id');

  const professionalProfiles = [
    {
      user_id: fixture.investor.id,
      category: 'Investor',
      subcategory: 'Cash Buyer',
      markets: ['Dallas, TX', 'Texas'],
      skills: ['Cash Only', 'Close < 14 days'],
      services: ['Acquisition'],
      pitch: `${runId} buyer profile`,
      primary_category: 'investor',
      category_b: 'cash_buyer',
      primary_category_b: 'cash_buyer',
      profile_payload: makeProfilePayload({ name: fixture.investor.name, email: fixture.investor.email, phone: '+12145550101' }),
    },
    {
      user_id: fixture.owner.id,
      category: 'FSBO',
      subcategory: 'Owner',
      markets: ['Dallas, TX'],
      skills: ['Seller'],
      services: ['Property Sale'],
      pitch: `${runId} FSBO owner`,
      primary_category: 'fsbo',
      category_b: 'owner',
      primary_category_b: 'owner',
      profile_payload: makeProfilePayload({ name: fixture.owner.name, email: fixture.owner.email, phone: '+12145550102', role: 'fsbo' }),
    },
    {
      user_id: fixture.provider.id,
      category: 'General Contractor',
      subcategory: 'Rehab',
      markets: ['Dallas, TX', 'Texas'],
      skills: ['Rehab', 'Inspection'],
      services: ['General Contractor'],
      pitch: `${runId} provider profile`,
      primary_category: 'provider',
      category_b: 'contractor',
      primary_category_b: 'contractor',
      profile_payload: makeProfilePayload({ name: fixture.provider.name, email: fixture.provider.email, phone: '+12145550103' }),
    },
  ];
  await restUpsert('professional_profiles', professionalProfiles, 'user_id');

  const property = await restInsertReturning('properties', {
    owner_id: fixture.owner.id,
    type: 'Single Family',
    address: `123 ${runId} Private Street`,
    city: 'Dallas',
    state: 'TX',
    zip: '75201',
    price: 250000,
    beds: 3,
    baths: 2,
    sqft: '1650',
    improvement: 'Light rehab',
    lot: '0.18 acres',
    deal_tag: 'FSBO',
    objective: 'SELL',
    rehab: 35000,
    cap_rate: 5,
    description: `${runId} real backend fixture property with service needs for contractor validation.`,
    markets: ['Dallas, TX', 'Texas'],
    is_active: true,
    publish_to_showcase: true,
    include_in_preview: true,
    source: 'fsbo',
    owner_account_type: 'fsbo_owner',
    primary_profile: 'fsbo',
    lat: 32.7767,
    lng: -96.797,
    geocode_status: 'resolved',
    geocode_source: 'e2e_fixture',
    geocode_confidence: 1,
    hide_street_address_on_card: true,
  });
  fixture.property = { id: property.id };

  await restInsertReturning('property_images', {
    property_id: fixture.property.id,
    image_url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80',
    sort_order: 0,
  });

  const restrictedPropertyBase = {
    owner_id: fixture.owner.id,
    type: 'Single Family',
    address: `987 ${runId} Restricted Street`,
    city: 'Dallas',
    state: 'TX',
    zip: '75202',
    price: 180000,
    beds: 2,
    baths: 1,
    sqft: '1100',
    improvement: 'Restricted fixture',
    lot: '0.12 acres',
    deal_tag: 'E2E',
    objective: 'SELL',
    rehab: 15000,
    cap_rate: 4,
    description: `${runId} restricted visibility fixture.`,
    markets: ['Dallas, TX'],
    include_in_preview: true,
    source: 'fsbo',
    owner_account_type: 'fsbo_owner',
    primary_profile: 'fsbo',
    lat: 32.781,
    lng: -96.801,
    hide_street_address_on_card: true,
  };
  const [hiddenProperty, inactiveProperty, closedProperty] = await Promise.all([
    restInsertReturning('properties', { ...restrictedPropertyBase, publish_to_showcase: false, is_active: true, deal_closed: false }),
    restInsertReturning('properties', { ...restrictedPropertyBase, publish_to_showcase: true, is_active: false, deal_closed: false }),
    restInsertReturning('properties', { ...restrictedPropertyBase, publish_to_showcase: true, is_active: true, deal_closed: true }),
  ]);
  fixture.hiddenProperty = { id: hiddenProperty.id };
  fixture.inactiveProperty = { id: inactiveProperty.id };
  fixture.closedProperty = { id: closedProperty.id };

  const service = await restInsertReturning('services', {
    owner_id: fixture.provider.id,
    title: `${runId} Dallas Rehab Contractor`,
    category: 'General Contractor',
    description: `${runId} provider service for rehab, inspection and contractor matching.`,
    price: 500,
    media_images: ['https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80'],
    publish_to_connections: true,
    markets: ['Dallas, TX', 'Texas'],
    primary_profile: 'professional',
  });
  fixture.service = { id: service.id };
}

async function setupRealBackendFixture() {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error('Real backend E2E requires E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY and E2E_SUPABASE_SERVICE_ROLE_KEY.');
  }
  const fixture = {
    runId,
    password: passwordForRun(),
    investor: await createAuthUser('investor'),
    owner: await createAuthUser('owner'),
    provider: await createAuthUser('provider'),
    property: null,
    service: null,
  };
  await upsertFixtureRows(fixture);
  return fixture;
}

async function cleanupRealBackendFixture(fixture) {
  const userIds = [fixture?.investor?.id, fixture?.owner?.id, fixture?.provider?.id].filter(Boolean);
  if (!userIds.length) return;
  const encodedIds = userIds.map((id) => `"${id}"`).join(',');
  await adminFetch(`/rest/v1/app_events?user_id=in.(${encodedIds})`, { method: 'DELETE' }).catch(() => {});
  await Promise.allSettled(userIds.map((id) => adminFetch(`/auth/v1/admin/users/${id}`, { method: 'DELETE' })));
}

async function signIn(email, password) {
  const { payload } = await parseResponse(await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  }));
  if (!payload.access_token) throw new Error('signIn failed: no access token');
  return payload;
}

async function browserRpc(page, { token, fn, body = {} }) {
  return page.evaluate(async ({ supabaseUrl: url, anonKey: key, tokenValue, fnName, rpcBody }) => {
    const response = await fetch(`${url}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${tokenValue}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rpcBody),
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
    return { ok: response.ok, status: response.status, payload };
  }, { ...publicEnv, tokenValue: token, fnName: fn, rpcBody: body });
}

async function browserRestSelect(page, { token, table, query }) {
  return page.evaluate(async ({ supabaseUrl: url, anonKey: key, tokenValue, tableName, queryString }) => {
    const response = await fetch(`${url}/rest/v1/${tableName}?${queryString}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${tokenValue}`,
      },
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
    return { ok: response.ok, status: response.status, payload };
  }, { ...publicEnv, tokenValue: token, tableName: table, queryString: query });
}

async function invokeFunction({ token, name, body = {} }) {
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  return { ok: response.ok, status: response.status, payload };
}

export const test = base.extend({
  // Playwright requires fixture callbacks to destructure their first argument.
  // eslint-disable-next-line no-empty-pattern
  realBackend: [async ({}, applyFixture) => {
    const fixture = await setupRealBackendFixture();
    try {
      await applyFixture({
        ...fixture,
        adminSelect: async (table, query) => {
          const { payload } = await adminFetch(`/rest/v1/${table}?${query}`);
          return payload;
        },
        adminRpc: async (fn, body = {}) => {
          const { payload } = await adminFetch(`/rest/v1/rpc/${fn}`, { method: 'POST', body });
          return payload;
        },
        adminDelete: async (table, query) => {
          await adminFetch(`/rest/v1/${table}?${query}`, { method: 'DELETE' });
        },
        signIn,
        browserRpc,
        browserRestSelect,
        invokeFunction,
        loginViaUi: (page, user) => loginAs(page, user),
        logoutViaUi: logout,
      });
    } finally {
      await cleanupRealBackendFixture(fixture);
    }
  }, { scope: 'worker' }],
});

export { expect };
