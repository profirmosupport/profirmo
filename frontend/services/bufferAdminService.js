// Admin-only Buffer.com helpers. Wrap the three endpoints exposed by
// /api/admin/buffer/* (the OAuth callback at /api/buffer/oauth-callback
// is browser-loaded, not called via XHR).

import { get, post } from '@/services/api';

function unwrap(res) {
  if (res && Object.prototype.hasOwnProperty.call(res, 'data')) return res.data;
  return res;
}

// Asks the backend for the Buffer authorize URL (auth-gated). Sends
// `Accept: application/json` so the controller returns the URL as JSON
// instead of 302-ing the browser. Caller is responsible for setting
// window.location to the returned URL so the actual navigation
// originates from the same browser session.
export async function startBufferOAuth() {
  // The shared `get` helper sets the Accept header to JSON and adds
  // the Bearer token automatically.
  const res = await get('/api/admin/buffer/oauth-start');
  const data = unwrap(res);
  return data && data.authorizeUrl ? data.authorizeUrl : null;
}

// Calls GET /api/admin/buffer/profiles. Returns { profiles: [...] }.
export async function listBufferProfiles() {
  const res = await get('/api/admin/buffer/profiles');
  return unwrap(res) || { profiles: [] };
}

// POST /api/admin/buffer/share-test/:postId. Triggers an immediate
// share of an existing post to every linked Buffer profile.
export async function bufferShareTest(postId) {
  const res = await post(`/api/admin/buffer/share-test/${postId}`, { now: true });
  return unwrap(res);
}
