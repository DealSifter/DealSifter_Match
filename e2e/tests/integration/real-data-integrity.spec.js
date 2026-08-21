import { randomUUID } from 'node:crypto';
import { test, expect } from '../../fixtures/realBackendFixture.js';

test('critical constraints reject invalid fixture writes and aggregate audit remains safe', async ({ realBackend }) => {
  const negativeBalance = await realBackend.adminRequest(`/rest/v1/users?id=eq.${realBackend.investor.id}`, {
    method: 'PATCH',
    body: { nuggets: -1 },
  });
  expect(negativeBalance.ok).toBe(false);
  expect(negativeBalance.status).toBe(400);

  const negativeProperty = await realBackend.adminRequest(`/rest/v1/properties?id=eq.${realBackend.property.id}`, {
    method: 'PATCH',
    body: { price: -1 },
  });
  expect(negativeProperty.ok).toBe(false);
  expect(negativeProperty.status).toBe(400);

  const selfUnlock = await realBackend.adminRequest('/rest/v1/unlocks', {
    method: 'POST',
    body: {
      id: randomUUID(),
      buyer_id: realBackend.investor.id,
      seller_id: realBackend.investor.id,
      profile_scope: 'professional',
      nuggets_spent: 0,
    },
  });
  expect(selfUnlock.ok).toBe(false);
  expect(selfUnlock.status).toBe(400);

  const investor = await realBackend.adminSelect('users', `select=nuggets&id=eq.${realBackend.investor.id}`);
  expect(investor).toHaveLength(1);
  expect(investor[0].nuggets).toBe(100);

  const audit = await realBackend.adminRpc('ds_data_integrity_audit');
  const critical = audit.filter((row) => Number(row.issue_count) > 0 && row.severity === 'CRITICAL');
  expect(critical).toEqual([]);
  expect(audit.every((row) => ['check_code', 'severity', 'issue_count'].every((key) => key in row))).toBe(true);
});
