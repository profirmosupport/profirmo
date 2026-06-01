// Tiny fetch wrapper for the Profirmo backend. Attaches the stored
// access token as a Bearer header and unwraps the `{success, message,
// data, errors}` envelope the backend returns.
//
// `handleUnauthorized` is set by AuthContext at mount-time so a 401
// can clear the local session and bounce the user back to the auth
// stack without this module taking a direct dependency on the context.

import { API_BASE_URL } from '../config/api';
import { getItem, STORAGE_KEYS } from '../utils/storage';

let _onUnauthorized = null;
export function registerUnauthorizedHandler(fn) {
  _onUnauthorized = fn;
}

async function request(path, { method = 'GET', body, query, headers = {} } = {}) {
  let url = API_BASE_URL + path;
  if (query && typeof query === 'object') {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(
        ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
      )
      .join('&');
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  const token = await getItem(STORAGE_KEYS.accessToken);
  const finalHeaders = {
    Accept: 'application/json',
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };
  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!res.ok) {
    if (res.status === 401 && _onUnauthorized) _onUnauthorized();
    const err = new Error((payload && payload.message) || `Request failed (${res.status})`);
    err.statusCode = res.status;
    err.payload = payload;
    err.errors = (payload && payload.errors) || null;
    throw err;
  }
  return payload;
}

// Convenience helpers — match the web client API shape.
export const apiGet = (path, opts = {}) => request(path, { ...opts, method: 'GET' });
export const apiPost = (path, body, opts = {}) =>
  request(path, { ...opts, method: 'POST', body });
export const apiPatch = (path, body, opts = {}) =>
  request(path, { ...opts, method: 'PATCH', body });
export const apiDelete = (path, opts = {}) =>
  request(path, { ...opts, method: 'DELETE' });

// Backend responses are wrapped in { success, message, data, ... } —
// most callers only care about `data`.
export function unwrap(res) {
  return res && Object.prototype.hasOwnProperty.call(res, 'data') ? res.data : res;
}
