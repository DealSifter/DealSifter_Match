/* global process */
import { expect } from '@playwright/test';
import { E2E_IDS, E2E_RUN_ID, E2E_USERS } from '../fixtures/e2eUsers.js';

const SUPABASE_URL = process.env.E2E_SUPABASE_URL || 'http://127.0.0.1:54321';
const JSON_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info,x-supabase-api-version,prefer,x-e2e-origin',
  'content-type': 'application/json; charset=utf-8',
};

const BASELINE_PROPERTY_IMAGE = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221200%22 height=%22800%22 viewBox=%220 0 1200 800%22%3E%3Crect width=%221200%22 height=%22800%22 fill=%22%23d9f5f4%22/%3E%3Cpath d=%22M100 610 390 320l180 180 150-150 380 380H100Z%22 fill=%22%2335cac9%22 opacity=%22.55%22/%3E%3Ccircle cx=%22920%22 cy=%22200%22 r=%2280%22 fill=%22%23f5a623%22 opacity=%22.8%22/%3E%3C/svg%3E';

function json(route, body, status = 200, extraHeaders = {}) {
  return route.fulfill({
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
    body: body === null || typeof body === 'undefined' ? '' : JSON.stringify(body),
  });
}

function parseBody(request) {
  try { return request.postDataJSON(); } catch { return {}; }
}

function bearerUserId(request) {
  const header = request.headers().authorization || '';
  const token = String(header).replace(/^Bearer\s+/i, '');
  const match = token.match(/^e2e-access-token:([0-9a-f-]+)$/i);
  return match?.[1] || '';
}

function sessionFor(user) {
  return {
    access_token: `e2e-access-token:${user.id}`,
    refresh_token: `e2e-refresh-token:${user.id}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      email_confirmed_at: new Date().toISOString(),
      user_metadata: { full_name: user.fullName },
      app_metadata: { provider: 'email', providers: ['email'] },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

function byEmail(email) {
  return Object.values(E2E_USERS).find((user) => user.email.toLowerCase() === String(email || '').toLowerCase());
}

function byUserId(userId) {
  return Object.values(E2E_USERS).find((user) => user.id === userId);
}

const property = {
  id: E2E_IDS.property,
  owner_id: E2E_USERS.provider.id,
  card_kind: 'property',
  type: 'SFR',
  price: 250000,
  sqft: 1850,
  bedrooms: 3,
  bathrooms: 2,
  city: 'Dallas',
  state: 'TX',
  zip: '75201',
  address: 'Dallas, TX',
  objective: 'FSBO',
  description: `E2E public showcase property for ${E2E_RUN_ID}. Strong candidate for provider fit checks.`,
  publish_to_showcase: true,
  is_active: true,
  deal_closed: false,
  hide_street_address_on_card: true,
  primary_profile: 'personal',
  estimated_rehab: 25000,
  cap_rate: 6.5,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

const providerService = {
  id: E2E_IDS.providerService,
  owner_id: E2E_USERS.provider.id,
  card_kind: 'service',
  title: `E2E Roofing & Rehab ${E2E_RUN_ID}`,
  category: 'Contractor',
  service_type: 'roofing',
  serviceType: 'roofing',
  markets: ['TX', 'Dallas'],
  description: 'Public provider service fixture for safe browser E2E.',
  publish_to_connections: true,
  is_active: true,
  primary_profile: 'personal',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

const investorService = {
  id: '99999999-9999-4999-8999-999999999999',
  owner_id: E2E_USERS.investor.id,
  card_kind: 'service',
  title: `E2E Cash Buyer ${E2E_RUN_ID}`,
  category: 'Cash Buyer',
  service_type: 'cash_buyer',
  markets: ['TX', 'Dallas'],
  description: 'Completed owned portfolio fixture used to unlock authenticated navigation.',
  publish_to_connections: true,
  is_active: true,
  primary_profile: 'personal',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

function userRow(user) {
  return {
    id: user.id,
    full_name: user.fullName,
    nuggets: user.nuggets,
    plan_id: user.nuggets > 0 ? 'pro' : 'free',
    phone: '+1 555 0100',
    is_admin: false,
    settings_payload: {
      systemAccount: {
        fullName: user.fullName,
        email: user.email,
        phone: '+1 555 0100',
        phoneCountryCode: '+1',
        accountType: user.accountType,
      },
      userPreferences: {
        privacy: {
          presenceStatus: 'online',
          messagePreview: true,
        },
      },
    },
  };
}

function personalProfileRow(user, state = {}) {
  if (!user.fullName) return null;
  return {
    user_id: user.id,
    full_name: user.fullName,
    photo_url: '',
    bio: state.profileBioByUserId?.[user.id] || `Profile fixture owned by ${E2E_RUN_ID}.`,
    visibility: 'public',
  };
}

function professionalProfileRow(user) {
  if (!user.fullName) return null;
  return {
    user_id: user.id,
    category: user.accountType === 'contractor' ? 'provider' : 'investor',
    subcategory: user.accountType === 'contractor' ? 'Contractor' : 'Cash Buyer',
    markets: user.accountType === 'contractor' ? ['TX', 'Dallas'] : ['TX', 'Dallas'],
    skills: user.accountType === 'contractor' ? ['Roofing', 'Rehab'] : ['Cash Only'],
    services: user.accountType === 'contractor' ? ['Roofing', 'Rehab'] : [],
    pitch: user.accountType === 'contractor'
      ? 'Licensed local rehab provider.'
      : 'I buy Texas, Dallas, Single Family, ARV up to 500k, minimum 20% margin, cash only, closing under 14 days.',
    primary_category: user.accountType,
    category_b: '',
    primary_category_b: '',
    photo_b_url: '',
    profile_payload: {
      version: 1,
      accountType: 'professional',
      profiles: {
        personal: {
          fullNameA: user.fullName,
          emailA: user.email,
          primaryPhoneA: '+1 555 0100',
          locA: 'Dallas, TX',
        },
      },
      legacy: {
        professionalProfile: {
          fullNameA: user.fullName,
          emailA: user.email,
          primaryPhoneA: '+1 555 0100',
          locA: 'Dallas, TX',
        },
      },
      testRunId: E2E_RUN_ID,
      buyerCriteria: {
        markets: ['Texas', 'Dallas'],
        propertyType: 'Single Family',
        arvMax: 500000,
        minimumMargin: 20,
        funding: 'Cash Only',
        closingDays: 14,
      },
    },
    profile_version: 3,
  };
}

function tablePayload(table, userId, wantsObject, state = {}) {
  const user = byUserId(userId) || E2E_USERS.investor;
  const arrays = {
    users: [userRow(user)],
    user_profiles: [personalProfileRow(user, state)].filter(Boolean),
    professional_profiles: [professionalProfileRow(user)].filter(Boolean),
    properties: user.id === E2E_USERS.provider.id ? [property] : [],
    services: user.id === E2E_USERS.provider.id
      ? [providerService]
      : user.id === E2E_USERS.investor.id
        ? [investorService]
        : [],
    property_images: [
      {
        id: 'img-e2e-1',
        property_id: E2E_IDS.property,
        image_url: BASELINE_PROPERTY_IMAGE,
        sort_order: 0,
      },
    ],
    subscriptions: [
      {
        user_id: user.id,
        plan_id: user.nuggets > 0 ? 'pro' : 'free',
        plan_name: user.nuggets > 0 ? 'Pro' : 'Free',
        price_cents: user.nuggets > 0 ? 2900 : 0,
        status: 'active',
        current_period_end: '2026-12-31T00:00:00.000Z',
      },
    ],
    user_feed_actions: state.baseline ? [
      {
        user_id: user.id,
        action: 'matched',
        entity_type: 'person',
        entity_id: E2E_USERS.provider.id,
        owner_id: E2E_USERS.provider.id,
        payload: {
          ownerId: E2E_USERS.provider.id,
          primaryProfile: 'personal',
        },
        updated_at: '2026-01-03T00:00:00.000Z',
      },
      {
        user_id: user.id,
        action: 'interested',
        entity_type: 'property',
        entity_id: E2E_IDS.property,
        owner_id: E2E_USERS.provider.id,
        payload: { ownerId: E2E_USERS.provider.id },
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ] : [],
    unlocks: [],
    property_unlocks: [],
    chat_messages: state.baseline ? [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        sender_id: E2E_USERS.provider.id,
        recipient_id: user.id,
        contact_owner_id: E2E_USERS.provider.id,
        body: 'The inspection window is available tomorrow morning.',
        message_type: 'text',
        message_code: null,
        message_params: {},
        metadata: { originalLang: 'en', translatedLang: 'en' },
        read_at: '2026-01-04T12:05:00.000Z',
        created_at: '2026-01-04T12:00:00.000Z',
      },
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
        sender_id: user.id,
        recipient_id: E2E_USERS.provider.id,
        contact_owner_id: E2E_USERS.provider.id,
        body: 'Great, please reserve the 9 AM slot.',
        message_type: 'text',
        message_code: null,
        message_params: {},
        metadata: { originalLang: 'en', translatedLang: 'en' },
        read_at: '2026-01-04T12:06:00.000Z',
        created_at: '2026-01-04T12:05:00.000Z',
      },
    ] : [],
    consent_records: [],
    nugget_purchases: [],
  };
  const result = arrays[table] || [];
  return wantsObject ? (result[0] || null) : result;
}

function publicInventory() {
  return {
    properties: [property],
    services: [providerService],
    users: [
      {
        id: E2E_USERS.provider.id,
        full_name: E2E_USERS.provider.fullName,
        plan_id: 'pro',
      },
    ],
    professionalProfiles: [
      {
        user_id: E2E_USERS.provider.id,
        category: 'provider',
        subcategory: 'Contractor',
        markets: ['TX', 'Dallas'],
        skills: ['Roofing', 'Rehab'],
        services: ['Roofing', 'Rehab'],
        pitch: 'Licensed local rehab provider.',
        primary_category: 'contractor',
        profile_version: 3,
      },
    ],
    propertyImages: [
      {
        id: 'img-e2e-1',
        property_id: E2E_IDS.property,
        image_url: BASELINE_PROPERTY_IMAGE,
        sort_order: 0,
      },
    ],
    spotlights: [],
  };
}

function planSnapshot(userId) {
  const user = byUserId(userId) || E2E_USERS.investor;
  return {
    plan: {
      id: user.nuggets > 0 ? 'pro' : 'free',
      planId: user.nuggets > 0 ? 'pro' : 'free',
      name: user.nuggets > 0 ? 'Pro' : 'Free',
      planName: user.nuggets > 0 ? 'Pro' : 'Free',
      status: 'active',
      price: 0,
      source: 'e2e_fixture',
    },
    nuggets: user.nuggets,
    limits: {},
    usage: {},
  };
}

function maxxisPropertyData() {
  return {
    property: {
      id: E2E_IDS.property,
      type: 'SFR',
      city: 'Dallas',
      state: 'TX',
      price: 250000,
      sqft: 1850,
      bedrooms: 3,
      bathrooms: 2,
      objective: 'FSBO',
    },
    missingFields: [],
    metrics: {
      pricePerSqft: { calculable: true, value: 135.14, source: 'calculated' },
      acquisitionPlusRehab: { calculable: true, value: 275000, source: 'calculated' },
      capRate: { calculable: true, value: 6.5, source: 'stored' },
    },
    advisor: {
      positive: ['property_published', 'basic_details_complete'],
      attention: [],
      missing: [],
      limitations: ['analysis_depends_on_submitted_data'],
    },
    workflow: {
      propertyId: E2E_IDS.property,
      status: 'active',
      items: [
        { code: 'inspection_completed', status: 'pending', label: 'Inspection', manual: true },
        { code: 'rehab_quote_received', status: 'pending', label: 'Rehab quote', manual: true },
      ],
    },
    serviceNeeds: [
      {
        serviceType: 'General Contractor',
        title: 'General contractor rehab review',
        priority: 'high',
        reasonCode: 'rehab_reported',
        confidence: 'high',
      },
    ],
    serviceMatches: [
      {
        serviceType: 'General Contractor',
        fit: { calculable: true, score: 86, classification: 'good', reasons: ['market_match', 'service_type_match'] },
        services: [{
          id: E2E_IDS.providerService,
          serviceId: E2E_IDS.providerService,
          serviceType: 'General Contractor',
          title: providerService.title,
          markets: ['TX', 'Dallas'],
          fit: { calculable: true, score: 86, classification: 'good', reasons: ['market_match', 'service_type_match'] },
          contactAccess: { status: 'locked', cost: 1, currency: 'nuggets' },
        }],
      },
    ],
  };
}

export async function setupMockSupabase(context, options = {}) {
  const state = {
    baseline: options.baseline === true,
    currentUserId: '',
    profileBioByUserId: {},
    unlockPrepares: 0,
    unlockCancels: 0,
    unlockConfirms: 0,
    messageDrafts: 0,
    messageCancels: 0,
    messagesSent: 0,
  };

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!request.url().startsWith(SUPABASE_URL)) return route.continue();

    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: JSON_HEADERS, body: '' });

    const pathname = url.pathname;
    const userId = bearerUserId(request);

    if (pathname.startsWith('/auth/v1/token')) {
      const body = parseBody(request);
      const refreshToken = String(body.refresh_token || '');
      if (refreshToken.startsWith('e2e-refresh-token:')) {
        const user = byUserId(refreshToken.replace('e2e-refresh-token:', ''));
        if (!user) return json(route, { error: 'invalid_grant' }, 400);
        state.currentUserId = user.id;
        return json(route, sessionFor(user));
      }
      const user = byEmail(body.email);
      if (!user || user.password !== body.password) {
        return json(route, { error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
      }
      state.currentUserId = user.id;
      return json(route, sessionFor(user));
    }

    if (pathname === '/auth/v1/logout') {
      state.currentUserId = '';
      return route.fulfill({ status: 204, headers: JSON_HEADERS, body: '' });
    }

    if (pathname === '/auth/v1/user') {
      const user = byUserId(userId);
      if (!user) return json(route, { message: 'JWT required' }, 401);
      return json(route, sessionFor(user).user);
    }

    if (pathname.startsWith('/functions/v1/')) {
      const fn = pathname.split('/').pop();
      if (!byUserId(userId)) return json(route, { success: false, error: 'UNAUTHORIZED' }, 401);
      const requestOrigin = url.searchParams.get('e2e_origin') || request.headers()['x-e2e-origin'] || request.headers().origin || '';
      if (requestOrigin === 'https://evil.example') {
        return json(route, { success: false, error: 'ORIGIN_NOT_ALLOWED' }, 403);
      }

      if (fn === 'maxxis-chat') {
        const body = parseBody(request);
        const message = String(body.message || '').toLowerCase();
        const type = message.includes('copilot') ? 'deal_copilot_overview' : 'property_details';
        const data = type === 'deal_copilot_overview'
          ? {
              propertySummary: maxxisPropertyData().property,
              metricsSummary: { metrics: maxxisPropertyData().metrics },
              advisorSummary: { attentionPoints: [] },
              serviceSummary: {
                needs: maxxisPropertyData().serviceNeeds,
                providers: [maxxisPropertyData().serviceMatches[0].services[0]],
              },
              workflow: maxxisPropertyData().workflow,
              capabilitiesUnavailable: [],
            }
          : maxxisPropertyData();
        return json(route, {
          success: true,
          type,
          message: type === 'deal_copilot_overview'
            ? 'Deal Copilot overview ready with structured service needs and provider fit.'
            : 'Property details ready with structured service needs and provider fit.',
          data,
        });
      }
      if (fn === 'maxxis-provider-unlock-prepare') {
        state.unlockPrepares += 1;
        return json(route, {
          success: true,
          status: 'pending_confirmation',
          action: {
            intentToken: E2E_IDS.unlockIntent,
            serviceId: E2E_IDS.providerService,
            cost: 1,
            currency: 'nuggets',
            serviceType: 'roofing',
            markets: ['TX', 'Dallas'],
          },
          contactAccess: { status: 'locked', cost: 1, currency: 'nuggets' },
        });
      }
      if (fn === 'maxxis-provider-unlock-cancel') {
        state.unlockCancels += 1;
        return json(route, { success: true, status: 'cancelled' });
      }
      if (fn === 'maxxis-provider-unlock-confirm') {
        state.unlockConfirms += 1;
        return json(route, { success: false, status: 'E2E_CONFIRM_BLOCKED' }, 409);
      }
      if (fn === 'maxxis-provider-message-draft') {
        state.messageDrafts += 1;
        return json(route, {
          success: true,
          message: 'Draft prepared, not sent.',
          draft: 'Hello, can you provide a roof inspection estimate for this Dallas property?',
          contactAccess: { status: 'locked', cost: 1, currency: 'nuggets' },
        });
      }
      if (fn === 'maxxis-provider-message-cancel') {
        state.messageCancels += 1;
        return json(route, { success: true, status: 'cancelled' });
      }
      if (fn === 'maxxis-provider-message-prepare') {
        state.messagesSent += 0;
        return json(route, { success: true, action: { actionId: E2E_IDS.messageAction, cost: 0 } });
      }
      return json(route, { success: true });
    }

    if (pathname.startsWith('/rest/v1/rpc/')) {
      const rpc = pathname.split('/').pop();
      if (!byUserId(userId)) return json(route, { code: '401', message: 'JWT required' }, 401);
      if (rpc === 'ds_get_global_feed_inventory') return json(route, publicInventory());
      if (rpc === 'ds_get_plan_usage_snapshot') return json(route, planSnapshot(userId));
      if (rpc === 'ds_get_unlocked_contact_cards') {
        return json(route, state.baseline ? [{
          owner_id: E2E_USERS.provider.id,
          primary_profile: 'personal',
          unlock_scope: 'contact',
          unlocked_at: '2026-01-04T00:00:00.000Z',
          unlocked_property_ids: [E2E_IDS.property],
          contact: {
            name: E2E_USERS.provider.fullName,
            category: 'Contractor',
            location: 'Dallas, TX',
            email: null,
            phone_primary: null,
            contact_methods: ['DealSifter chat'],
          },
          portfolio: [{
            item_id: E2E_IDS.property,
            item_type: 'property',
            title: 'Dallas, TX',
            is_unlocked: true,
            is_exclusive: false,
          }],
        }] : []);
      }
      if (rpc === 'ds_get_chat_contact_status') return json(route, state.baseline
        ? { status: 'unlocked', unlocked: true, canChat: true, acceptsChat: true, senderCanChat: true }
        : { status: 'locked', unlocked: false });
      if (rpc === 'ds_get_provider_contact_access') return json(route, { status: 'locked', cost: 1, currency: 'nuggets' });
      if (rpc === 'ds_consume_plan_actions') return json(route, { allowed: true, remaining: 99 });
      if (rpc === 'track_user_heartbeat' || rpc === 'track_app_event') return json(route, { ok: true });
      if (rpc === 'ds_save_professional_profile') {
        if (state.baseline) return json(route, { success: true, profileVersion: 4 });
        const body = parseBody(request);
        if (Number(body.p_expected_profile_version || 0) < 3) {
          return json(route, { code: 'PROFILE_VERSION_CONFLICT', message: 'Profile changed by another session.' }, 409);
        }
        return json(route, { success: true, profileVersion: 4 });
      }
      if (rpc === 'ds_send_support_message') return json(route, { success: true });
      if (rpc === 'ds_get_my_support_thread') return json(route, []);
      return json(route, {});
    }

    if (pathname.startsWith('/rest/v1/')) {
      if (!byUserId(userId)) return json(route, { code: '401', message: 'JWT required' }, 401);
      const table = pathname.replace('/rest/v1/', '').split('/')[0];
      const wantsObject = String(request.headers().accept || '').includes('vnd.pgrst.object+json');
      if (request.method() === 'PATCH' || request.method() === 'POST' || request.method() === 'PUT') {
        const body = parseBody(request);
        if (table === 'user_profiles' && typeof body.bio === 'string') {
          state.profileBioByUserId[userId] = body.bio;
        }
        const row = tablePayload(table, userId, true, state);
        return json(route, wantsObject ? (row || {}) : [row].filter(Boolean));
      }
      return json(route, tablePayload(table, userId, wantsObject, state));
    }

    return json(route, {});
  });

  return {
    state,
    users: E2E_USERS,
    ids: E2E_IDS,
    runId: E2E_RUN_ID,
    expectNoSensitivePublicInventory(payload) {
      const serialized = JSON.stringify(payload);
      expect(serialized).not.toContain(E2E_USERS.provider.email);
      expect(serialized).not.toContain('+1 555 0100');
      expect(serialized).not.toContain('profile_payload');
      expect(serialized).not.toContain('7081 Kalaniaole');
      expect(serialized).not.toContain('21.276');
      expect(serialized).not.toContain('-157.7');
    },
  };
}
