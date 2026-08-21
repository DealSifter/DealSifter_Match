import { test, expect } from '../../fixtures/realBackendFixture.js';

test('real published provider unlock produces a safe draft without extra debit or message', async ({ realBackend }) => {
  const session = await realBackend.signIn(realBackend.investor.email, realBackend.investor.password);
  const token = session.access_token;
  const beforeBalance = (await realBackend.adminSelect('users', `select=nuggets&id=eq.${realBackend.investor.id}`))[0].nuggets;

  const prepare = await realBackend.invokeFunction({
    token,
    name: 'maxxis-provider-unlock-prepare',
    body: { serviceId: realBackend.service.id },
  });
  expect(prepare.ok, JSON.stringify(prepare.payload)).toBe(true);
  expect(prepare.payload.action.intentToken).toBeTruthy();

  const unlock = await realBackend.invokeFunction({
    token,
    name: 'maxxis-provider-unlock-confirm',
    body: { serviceId: realBackend.service.id, intentToken: prepare.payload.action.intentToken },
  });
  expect(unlock.ok, JSON.stringify(unlock.payload)).toBe(true);
  expect(unlock.payload.status).toBe('unlocked');
  const afterUnlockBalance = (await realBackend.adminSelect('users', `select=nuggets&id=eq.${realBackend.investor.id}`))[0].nuggets;
  expect(afterUnlockBalance).toBe(beforeBalance - prepare.payload.action.cost);

  const draft = await realBackend.invokeFunction({
    token,
    name: 'maxxis-provider-message-draft',
    body: { serviceId: realBackend.service.id, propertyId: realBackend.property.id, language: 'en' },
  });
  expect(draft.ok, JSON.stringify(draft.payload)).toBe(true);
  expect(draft.payload).toMatchObject({
    success: true,
    type: 'provider_message_draft',
    data: {
      serviceId: realBackend.service.id,
      propertyId: realBackend.property.id,
      providerId: realBackend.provider.id,
    },
  });
  expect(JSON.stringify(draft.payload)).not.toMatch(/email|phone|whatsapp|address/i);

  const afterDraftBalance = (await realBackend.adminSelect('users', `select=nuggets&id=eq.${realBackend.investor.id}`))[0].nuggets;
  expect(afterDraftBalance).toBe(afterUnlockBalance);
  expect(await realBackend.adminSelect(
    'chat_messages',
    `select=id&sender_id=eq.${realBackend.investor.id}&recipient_id=eq.${realBackend.provider.id}`,
  )).toEqual([]);
});
