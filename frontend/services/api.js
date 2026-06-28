// Core HTTP client for the Profirmo backend.
// All service modules build on top of `apiRequest`.

import { API_BASE_URL as CONFIGURED_API_BASE_URL } from '@/utils/constants';

// Production routing: when the app is served from the profirmo.com domain,
// send API requests to the hosted backend. Everywhere else (local dev,
// previews) use the configured NEXT_PUBLIC_API_URL or the localhost default.
const PRODUCTION_HOSTS = ['profirmo.com', 'www.profirmo.com'];
// Production API host — EC2 + nginx + Let's Encrypt at proapi.profirmo.com
// (replaced the Render service https://profirmo.onrender.com on 2026-06-20).
const PRODUCTION_API_URL = 'https://proapi.profirmo.com';

export function getApiBaseUrl() {
  if (
    typeof window !== 'undefined' &&
    PRODUCTION_HOSTS.includes(window.location.hostname)
  ) {
    return PRODUCTION_API_URL;
  }
  return CONFIGURED_API_BASE_URL;
}

export const API_BASE_URL = CONFIGURED_API_BASE_URL;

// ---------------------------------------------------------------------------
// In-memory access-token holder.
// The 15-minute access token never touches localStorage — it lives only here
// (and in React state). The persistent session is the httpOnly pf_refresh
// cookie, which the browser sends automatically when `credentials: 'include'`.
// ---------------------------------------------------------------------------
let accessToken = null;

/** Store the current access token (pass null to clear). */
export function setAccessToken(token) {
  accessToken = token || null;
}

/** Read the currently held access token. */
export function getAccessToken() {
  return accessToken;
}

// Callbacks the AuthProvider registers so api.js can push refreshed tokens
// back into React context and trigger a logout when the session expires.
let onTokenRefreshed = null;
let onAuthExpired = null;

/**
 * Register auth lifecycle callbacks.
 * @param {Object} cbs
 * @param {Function} [cbs.onTokenRefreshed] - (newToken, user) => void
 * @param {Function} [cbs.onAuthExpired]    - () => void
 */
export function registerAuthCallbacks({
  onTokenRefreshed: refreshed,
  onAuthExpired: expired,
} = {}) {
  if (refreshed !== undefined) onTokenRefreshed = refreshed;
  if (expired !== undefined) onAuthExpired = expired;
}

/**
 * Build a query string from a params object. Skips null/undefined/'' values.
 */
function buildQuery(params) {
  if (!params || typeof params !== 'object') return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (v !== null && v !== undefined && v !== '') {
          search.append(key, String(v));
        }
      });
    } else {
      search.append(key, String(value));
    }
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

// Endpoints that must never trigger the refresh-on-401 retry loop.
const AUTH_NO_RETRY = [
  '/api/auth/refresh',
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/register-client',
  '/api/auth/register-professional',
  '/api/auth/register-firm',
];

function isNoRetryPath(path) {
  return AUTH_NO_RETRY.some((p) => path.startsWith(p));
}

// --- Refresh-call coalescing ----------------------------------------
// Multiple concurrent callers (AuthProvider mount + an in-flight API
// call that 401s + a separate visibility-change wake-up) can all
// race against /api/auth/refresh. Each call rotates the refresh
// cookie server-side, so the slower racers end up holding a stale
// cookie and fail — which then triggers onAuthExpired and a spurious
// "logout" redirect on hard refresh. Coalesce: any call to the
// refresh endpoint shares the single in-flight promise, so the
// cookie rotates exactly once per logical refresh.
let inflightRefreshPromise = null;

async function refreshOnce() {
  if (inflightRefreshPromise) return inflightRefreshPromise;
  inflightRefreshPromise = rawRequest('/api/auth/refresh', {
    method: 'POST',
  }).finally(() => {
    inflightRefreshPromise = null;
  });
  return inflightRefreshPromise;
}

/**
 * Public entry point for callers (e.g. AuthProvider on mount) who
 * want to deliberately kick off a refresh. Uses the same coalescer
 * so they don't race the 401-retry path.
 */
export async function refreshSession() {
  const res = await refreshOnce();
  return (res && res.data) || res || {};
}

/**
 * Perform a single raw HTTP request (no refresh logic).
 */
async function rawRequest(path, { method = 'GET', body, token, params } = {}) {
  const url = `${getApiBaseUrl()}${path}${buildQuery(params)}`;

  const headers = { 'Content-Type': 'application/json' };
  // Use the explicit token if given, otherwise fall back to the held token.
  const bearer = token !== undefined ? token : accessToken;
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  const init = {
    method,
    headers,
    cache: 'no-store',
    // Always send/receive cookies so the httpOnly pf_refresh cookie works.
    credentials: 'include',
  };
  if (body !== undefined && body !== null) {
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, init);
  } catch (networkError) {
    const err = new Error(
      'Unable to reach the server. Please check your connection.'
    );
    err.isNetworkError = true;
    throw err;
  }

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (parseError) {
      payload = null;
    }
  }

  if (!response.ok) {
    const message =
      (payload && (payload.message || payload.error)) ||
      `Request failed with status ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.payload = payload;
    throw err;
  }

  return payload || { success: true, data: null };
}

/**
 * Perform an HTTP request against the API.
 *
 * If a request returns HTTP 401 (and it is not itself an auth endpoint, and it
 * has not already been retried), this calls POST /api/auth/refresh once. On a
 * successful refresh the new access token is stored, `onTokenRefreshed` is
 * notified, and the original request is retried once with the new token. If
 * the refresh fails, `onAuthExpired` is invoked and the original error surfaces.
 *
 * @param {string} path - endpoint path, e.g. '/api/professionals'
 * @param {Object} [options]
 * @param {string} [options.method='GET']
 * @param {*}      [options.body]   - JSON-serialisable request body
 * @param {string} [options.token] - explicit bearer token (overrides held token)
 * @param {Object} [options.params]- query string params
 * @param {boolean}[options._retried] - internal: marks an already-retried call
 * @returns {Promise<{success:boolean,message?:string,data?:*,meta?:*}>}
 */
export async function apiRequest(path, options = {}) {
  try {
    return await rawRequest(path, options);
  } catch (error) {
    const canRetry =
      error &&
      error.status === 401 &&
      !options._retried &&
      !isNoRetryPath(path);

    if (!canRetry) throw error;

    // Attempt a single silent refresh — coalesced so concurrent
    // 401s share one network round trip rather than each rotating
    // the refresh cookie.
    let refreshData;
    try {
      const refreshRes = await refreshOnce();
      refreshData = (refreshRes && refreshRes.data) || refreshRes || {};
    } catch (refreshError) {
      // Refresh failed — the session is gone.
      if (typeof onAuthExpired === 'function') {
        try {
          onAuthExpired();
        } catch {
          /* ignore callback errors */
        }
      }
      throw error;
    }

    const newToken = refreshData.accessToken || refreshData.token || null;
    if (!newToken) {
      if (typeof onAuthExpired === 'function') {
        try {
          onAuthExpired();
        } catch {
          /* ignore */
        }
      }
      throw error;
    }

    setAccessToken(newToken);
    if (typeof onTokenRefreshed === 'function') {
      try {
        onTokenRefreshed(newToken, refreshData.user || null);
      } catch {
        /* ignore callback errors */
      }
    }

    // Retry the original request once with the fresh token.
    return rawRequest(path, {
      ...options,
      token: newToken,
      _retried: true,
    });
  }
}

/** GET convenience wrapper. */
export function get(path, options = {}) {
  return apiRequest(path, { ...options, method: 'GET' });
}

/** POST convenience wrapper. */
export function post(path, body, options = {}) {
  return apiRequest(path, { ...options, method: 'POST', body });
}

/** PATCH convenience wrapper. */
export function patch(path, body, options = {}) {
  return apiRequest(path, { ...options, method: 'PATCH', body });
}

/** PUT convenience wrapper. */
export function put(path, body, options = {}) {
  return apiRequest(path, { ...options, method: 'PUT', body });
}

/** DELETE convenience wrapper. Accepts options.body for endpoints
 *  that require a payload (e.g. soft-delete with a reason). */
export function del(path, options = {}) {
  return apiRequest(path, { ...options, method: 'DELETE' });
}

export default {
  apiRequest,
  get,
  post,
  patch,
  put,
  del,
  API_BASE_URL,
  getApiBaseUrl,
  setAccessToken,
  getAccessToken,
  registerAuthCallbacks,
};
