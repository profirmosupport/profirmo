// adminSettingsService — typed wrapper over GET /api/admin/settings and
// PATCH /api/admin/settings/:key, plus the storage-test action.

import { get, patch, post } from '@/services/api';

function unwrap(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

export async function listSettings() {
  const res = await get('/api/admin/settings');
  const data = unwrap(res);
  return (data && data.items) || [];
}

export async function updateSetting(key, value) {
  const res = await patch(`/api/admin/settings/${key}`, { value });
  return unwrap(res);
}

// POST /api/admin/settings/storage/test — uploads + deletes a tiny
// file in temp/ to verify the AWS credentials currently in admin
// settings can reach the bucket. Returns `{ ok, bucket, region, testKey }`
// on success, throws with the upstream message on failure.
export async function testStorageConnection() {
  const res = await post('/api/admin/settings/storage/test');
  return unwrap(res);
}

// POST /api/admin/settings/email/test — sends a one-off "Profirmo SMTP
// test" message via the live admin SMTP transport. Recipient defaults
// to the authenticated admin's email server-side; pass `{ to }` to
// override.
export async function testEmailConnection(to) {
  const res = await post('/api/admin/settings/email/test', to ? { to } : {});
  return unwrap(res);
}
