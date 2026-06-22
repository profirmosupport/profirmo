// userPreferenceService — wraps /api/user-prefs.

import { get, put } from '@/services/api';

function unwrap(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

export async function getAllPrefs() {
  const res = await get('/api/user-prefs');
  return unwrap(res) || {};
}

export async function getPref(key) {
  const res = await get(`/api/user-prefs/${encodeURIComponent(key)}`);
  const data = unwrap(res);
  return data ? data.value : null;
}

export async function setPref(key, value) {
  const res = await put(`/api/user-prefs/${encodeURIComponent(key)}`, { value });
  return unwrap(res);
}
