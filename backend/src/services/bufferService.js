// bufferService — Buffer.com v1 REST integration. Used by the AI
// blog flow (daily cron + admin "Generate with AI" button) to share
// a freshly published post across every social profile the admin
// has linked in their Buffer dashboard.
//
// Buffer API docs: https://buffer.com/developers/api
// Two endpoints we use:
//   GET  /1/profiles.json                — list all linked profiles
//   POST /1/updates/create.json          — schedule (or `now: true`,
//                                          post immediately)
// Auth: ?access_token=<token> in the URL OR Authorization: Bearer.
// We use the Authorization header so the token never lands in proxy
// access logs.
//
// All functions are best-effort: failures are logged + a sentinel is
// returned. The blog flow's caller must NOT let a Buffer outage
// block post creation.

const https = require('https');
const adminSettings = require('./adminSettingsService');

const BUFFER_HOST = 'api.bufferapp.com';
const BUFFER_AUTHORIZE_HOST = 'bufferapp.com';
const BUFFER_AUTHORIZE_PATH = '/oauth2/authorize';
const BUFFER_TOKEN_PATH = '/1/oauth2/token.json';
const REQUEST_TIMEOUT_MS = 15 * 1000;

async function getAccessToken() {
  return adminSettings.getString('buffer_access_token');
}

async function isConfigured() {
  const token = await getAccessToken();
  return Boolean(token && token.trim());
}

// --- OAuth setup --------------------------------------------------
//
// Buffer requires the authorization-code grant: redirect the admin
// to bufferapp.com/oauth2/authorize, they approve, Buffer redirects
// back to our callback with ?code=…, we POST that code to
// /1/oauth2/token.json with the client_secret to exchange it for an
// access_token. Client-credentials grant is NOT supported by Buffer.

function buildAuthorizeUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
  });
  if (state) params.set('state', state);
  return `https://${BUFFER_AUTHORIZE_HOST}${BUFFER_AUTHORIZE_PATH}?${params.toString()}`;
}

// Exchange a Buffer authorization code for an access_token. The
// token doesn't expire — Buffer issues long-lived tokens — but it
// can be revoked from the user's apps page, in which case the next
// share call returns 401 and we surface a clear "reconnect" message.
async function exchangeCodeForToken({ code, clientId, clientSecret, redirectUri }) {
  if (!code) throw new Error('exchangeCodeForToken: code required');
  if (!clientId || !clientSecret) {
    throw new Error('exchangeCodeForToken: client credentials required');
  }
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
    grant_type: 'authorization_code',
  });
  const body = params.toString();
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: BUFFER_HOST,
        path: BUFFER_TOKEN_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
          Accept: 'application/json',
          'User-Agent': 'Profirmo-AI-Blog/1.0 (+https://profirmo.com)',
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (resp) => {
        const chunks = [];
        resp.on('data', (c) => chunks.push(c));
        resp.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {}
          if (!resp.statusCode || resp.statusCode >= 400 || !json || !json.access_token) {
            const detail =
              (json && (json.error_description || json.error || json.message)) ||
              text.slice(0, 200);
            return reject(
              new Error(`Buffer token exchange failed (HTTP ${resp.statusCode}): ${detail}`)
            );
          }
          resolve({
            accessToken: json.access_token,
            tokenType: json.token_type || 'bearer',
            raw: json,
          });
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Buffer token exchange timed out.')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Minimal HTTPS helper for Buffer responses. Non-2xx bodies include a
// JSON `error` field (or `message`) which we surface in admin logs.
function buildHeaders(token, body) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'Profirmo-AI-Blog/1.0 (+https://profirmo.com)',
    Accept: 'application/json',
  };
  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['Content-Length'] = Buffer.byteLength(body);
  }
  return headers;
}

function executeRequest({ method, path, token, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: BUFFER_HOST,
        path,
        method,
        headers: buildHeaders(token, body),
        timeout: REQUEST_TIMEOUT_MS,
      },
      (resp) => {
        const chunks = [];
        resp.on('data', (c) => chunks.push(c));
        resp.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {}
          if (!resp.statusCode || resp.statusCode >= 400) {
            const detail =
              (json && (json.error || json.message)) || text.slice(0, 200);
            const err = new Error(`Buffer HTTP ${resp.statusCode}: ${detail}`);
            err.statusCode = resp.statusCode;
            err.body = json || text;
            return reject(err);
          }
          resolve(json || {});
        });
        resp.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new Error('Buffer request timed out.')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function bufferGet(path, token) {
  return executeRequest({ method: 'GET', path, token, body: null });
}

function bufferPost(path, token, body) {
  return executeRequest({ method: 'POST', path, token, body });
}

// GET /1/profiles.json → array of profile objects with `id`, `service`
// (twitter, linkedin, facebook, instagram, threads, …), `username` etc.
async function listProfiles() {
  const token = await getAccessToken();
  if (!token) throw new Error('Buffer access token not configured.');
  return bufferGet('/1/profiles.json', token);
}

// Build the share text. Different networks have different sweet
// spots; we keep one body that reads well on LinkedIn/Facebook and
// trust Buffer to truncate appropriately on Twitter/Threads.
function buildShareText({ title, excerpt, url, tags }) {
  const lines = [String(title || '').trim()];
  const ex = String(excerpt || '').trim();
  if (ex) {
    lines.push('');
    lines.push(ex);
  }
  if (url) {
    lines.push('');
    lines.push(`Read more: ${url}`);
  }
  if (Array.isArray(tags) && tags.length) {
    const hashtags = tags
      .slice(0, 4)
      .map((t) => '#' + String(t).replace(/[^A-Za-z0-9]/g, ''))
      .filter((t) => t.length > 1)
      .join(' ');
    if (hashtags) {
      lines.push('');
      lines.push(hashtags);
    }
  }
  return lines.join('\n');
}

/**
 * Share a freshly published blog post to every linked Buffer
 * profile. Returns { posted: <count>, profileIds: [...], updateIds: [...] }
 * on success. Throws (or returns { skipped: true, reason } via the
 * caller's try/catch) on failure — callers wrap this with a non-
 * fatal try/catch so a Buffer outage can't break the blog flow.
 *
 * @param {object} args
 * @param {string} args.title    — blog title (required)
 * @param {string} [args.excerpt]
 * @param {string} args.url      — public URL of the published post (required)
 * @param {string} [args.imageUrl] — featured image (used as media.photo)
 * @param {string[]} [args.tags] — tag slugs/names for hashtag generation
 * @param {object} [opts]
 * @param {boolean} [opts.now=true]
 *   true → post immediately on every profile (used by cron / button)
 *   false → queue at the next slot in each profile's Buffer schedule
 */
async function shareBlogPost(
  { title, excerpt, url, imageUrl, tags },
  { now = true } = {}
) {
  const token = await getAccessToken();
  if (!token) {
    return { skipped: true, reason: 'buffer_access_token not configured' };
  }
  if (!title || !url) {
    throw new Error('shareBlogPost requires title + url.');
  }

  const profiles = await listProfiles();
  const profileIds = Array.isArray(profiles)
    ? profiles.map((p) => p && p.id).filter(Boolean)
    : [];
  if (profileIds.length === 0) {
    return { skipped: true, reason: 'No Buffer profiles linked.' };
  }

  // Buffer's /1/updates/create.json takes profile_ids[] as repeated
  // form params. URLSearchParams.append() preserves duplicate keys.
  const params = new URLSearchParams();
  params.append('text', buildShareText({ title, excerpt, url, tags }));
  params.append('shorten', 'true');
  params.append('now', now ? 'true' : 'false');
  params.append('media[link]', url);
  params.append('media[title]', String(title).slice(0, 120));
  if (excerpt) {
    params.append('media[description]', String(excerpt).slice(0, 240));
  }
  if (imageUrl) {
    // Buffer accepts either `media[picture]` (current docs) or the
    // older `media[photo]`. Sending both keeps us compatible with
    // legacy profiles that still expect the old field.
    params.append('media[picture]', imageUrl);
    params.append('media[thumbnail]', imageUrl);
    params.append('media[photo]', imageUrl);
  }
  profileIds.forEach((pid) => params.append('profile_ids[]', pid));

  const result = await bufferPost(
    '/1/updates/create.json',
    token,
    params.toString()
  );

  const updateIds = Array.isArray(result.updates)
    ? result.updates.map((u) => u && u.id).filter(Boolean)
    : [];
  return {
    posted: updateIds.length,
    profileIds,
    updateIds,
    bufferCount: result.buffer_count || updateIds.length,
  };
}

module.exports = {
  isConfigured,
  listProfiles,
  shareBlogPost,
  buildShareText,
  buildAuthorizeUrl,
  exchangeCodeForToken,
};
