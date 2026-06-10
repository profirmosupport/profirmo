// Tiny fetch wrapper for the Profirmo backend. Attaches the stored
// access token as a Bearer header and unwraps the `{success, message,
// data, errors}` envelope the backend returns.
//
// `handleUnauthorized` is set by AuthContext at mount-time so a 401
// can clear the local session and bounce the user back to the auth
// stack without this module taking a direct dependency on the context.

import { API_BASE_URL } from '../config/api';
import { getItem, removeItem, setItem, STORAGE_KEYS } from '../utils/storage';

let _onUnauthorized = null;
export function registerUnauthorizedHandler(fn) {
  _onUnauthorized = fn;
}

// Single in-flight refresh promise — multiple parallel 401s all wait
// for the same refresh round-trip instead of stampeding /api/auth/refresh.
let _refreshing = null;

async function tryRefreshAccessToken() {
  if (_refreshing) return _refreshing;
  _refreshing = (async () => {
    const stored = await getItem(STORAGE_KEYS.refreshToken);
    if (!stored) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: stored }),
      });
      if (!res.ok) return null;
      const json = await res.json().catch(() => null);
      const data = json && (json.data || json);
      const next = data && (data.accessToken || data.token);
      if (!next) return null;
      await setItem(STORAGE_KEYS.accessToken, next);
      if (data.refreshToken) {
        await setItem(STORAGE_KEYS.refreshToken, data.refreshToken);
      }
      return next;
    } catch {
      return null;
    } finally {
      // Reset in the next tick so the just-finished refresh isn't
      // reused for the next call cycle.
      setTimeout(() => {
        _refreshing = null;
      }, 0);
    }
  })();
  return _refreshing;
}

async function rawFetch(url, method, body, headers) {
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
  const text = await res.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }
  return { res, payload };
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

  let { res, payload } = await rawFetch(url, method, body, headers);

  // Transparent refresh-and-retry on a 401. The 15-min access token
  // expires mid-session; instead of kicking the user back to login we
  // post the stored refresh token, accept the new accessToken, and
  // replay the original request once. Refresh failures (refresh token
  // itself expired / revoked) fall through to the normal 401 path
  // below and clear the session.
  if (
    res.status === 401 &&
    path !== '/api/auth/refresh' &&
    path !== '/api/auth/login' &&
    path !== '/api/auth/phone-login' &&
    path !== '/api/auth/phone-signup'
  ) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      ({ res, payload } = await rawFetch(url, method, body, headers));
    }
  }

  if (!res.ok) {
    // Only fire the global session-clear on session-validation
    // endpoints — /api/auth/me (cold-start hydration) and
    // /api/auth/refresh (refresh itself failed → session is truly
    // over). Other 401s leave the session intact so a transient
    // server hiccup doesn't bounce the user to login.
    if (
      res.status === 401 &&
      _onUnauthorized &&
      (path === '/api/auth/me' || path === '/api/auth/refresh')
    ) {
      // Refresh failed too — wipe the stored refresh token so we
      // don't keep retrying with a dead one.
      await removeItem(STORAGE_KEYS.refreshToken).catch(() => {});
      _onUnauthorized();
    }
    const err = new Error(
      (payload && payload.message) || `Request failed (${res.status})`
    );
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
export const apiPut = (path, body, opts = {}) =>
  request(path, { ...opts, method: 'PUT', body });
export const apiDelete = (path, opts = {}) =>
  request(path, { ...opts, method: 'DELETE' });

// Backend responses are wrapped in { success, message, data, ... } —
// most callers only care about `data`.
export function unwrap(res) {
  return res && Object.prototype.hasOwnProperty.call(res, 'data') ? res.data : res;
}
