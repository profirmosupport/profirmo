// Core HTTP client for the Profirmo backend.
// All service modules build on top of `apiRequest`.

import { API_BASE_URL } from '@/utils/constants';

export { API_BASE_URL };

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

/**
 * Perform an HTTP request against the API.
 * @param {string} path - endpoint path, e.g. '/api/professionals'
 * @param {Object} [options]
 * @param {string} [options.method='GET']
 * @param {*}      [options.body]   - JSON-serialisable request body
 * @param {string} [options.token] - bearer token
 * @param {Object} [options.params]- query string params
 * @returns {Promise<{success:boolean,message?:string,data?:*,meta?:*}>}
 */
export async function apiRequest(
  path,
  { method = 'GET', body, token, params } = {}
) {
  const url = `${API_BASE_URL}${path}${buildQuery(params)}`;

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const init = {
    method,
    headers,
    cache: 'no-store',
  };
  if (body !== undefined && body !== null) {
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, init);
  } catch (networkError) {
    throw new Error(
      'Unable to reach the server. Please check your connection.'
    );
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
    throw new Error(message);
  }

  return payload || { success: true, data: null };
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

/** DELETE convenience wrapper. */
export function del(path, options = {}) {
  return apiRequest(path, { ...options, method: 'DELETE' });
}

export default { apiRequest, get, post, patch, del, API_BASE_URL };
