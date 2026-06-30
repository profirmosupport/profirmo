// bufferService — Buffer.com integration. Uses the new GraphQL API
// at api.buffer.com (the legacy REST at api.bufferapp.com no longer
// accepts public-API personal tokens — it returns "Public API tokens
// are not accepted for REST API access" with HTTP 401).
//
// Auth: a single personal access token from
// https://publish.buffer.com/developers/apps → "Access token" field
// is stored in admin_settings.buffer_access_token and sent as
// `Authorization: Bearer <token>` on every GraphQL request.
//
// Flow used by the AI blog publisher:
//   1. account.organizations → pick the first org id
//   2. channels(input: { organizationId }) → list every linked channel
//   3. createPost(input: { channelId, mode: shareNow, schedulingType:
//      automatic, text, assets: [ { link: { url, title, description,
//      thumbnailUrl } } ] }) — one mutation per channel, fired in
//      parallel.
//
// All functions are best-effort. shareBlogPost catches per-channel
// failures so a single bad channel can't tank the whole share.

const https = require('https');
const adminSettings = require('./adminSettingsService');

const BUFFER_HOST = 'api.buffer.com';
const BUFFER_PATH = '/graphql';
const REQUEST_TIMEOUT_MS = 20 * 1000;

async function getAccessToken() {
  return adminSettings.getString('buffer_access_token');
}

async function isConfigured() {
  const token = await getAccessToken();
  return Boolean(token && token.trim());
}

// Minimal GraphQL HTTPS helper. Buffer responses always carry JSON,
// even for GraphQL errors (which are HTTP 200 with an `errors` array).
function gqlRequest(query, variables, token) {
  const body = JSON.stringify({ query, variables: variables || {} });
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: BUFFER_HOST,
        path: BUFFER_PATH,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
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
          if (!resp.statusCode || resp.statusCode >= 400) {
            return reject(
              new Error(
                `Buffer GraphQL HTTP ${resp.statusCode}: ${text.slice(0, 200)}`
              )
            );
          }
          if (json && Array.isArray(json.errors) && json.errors.length) {
            const msg = json.errors
              .map((e) => e.message || (e.extensions && e.extensions.code))
              .filter(Boolean)
              .join('; ');
            return reject(new Error(`Buffer GraphQL: ${msg}`));
          }
          resolve(json && json.data);
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Buffer request timed out.')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Returns the first organization id on the account. Buffer accounts
// always have at least one org (the personal "My Organization").
async function getOrganizationId(token) {
  const data = await gqlRequest(
    `query { account { id name organizations { id name } } }`,
    null,
    token
  );
  const orgs =
    (data && data.account && data.account.organizations) || [];
  if (!orgs.length) {
    throw new Error('Buffer account has no organizations.');
  }
  return orgs[0].id;
}

// List every linked channel for the account's first organization.
// Returns an array of { id, service, displayName, descriptor }.
// Disconnected channels are filtered out so we don't try to post to
// a profile the user has revoked.
async function listChannels() {
  const token = await getAccessToken();
  if (!token) throw new Error('Buffer access token not configured.');
  const organizationId = await getOrganizationId(token);
  const data = await gqlRequest(
    `query ($input: ChannelsInput!) {
       channels(input: $input) {
         id
         service
         displayName
         descriptor
         isDisconnected
       }
     }`,
    { input: { organizationId } },
    token
  );
  return ((data && data.channels) || []).filter((c) => !c.isDisconnected);
}

// Build the share text. Different networks have different sweet
// spots; we keep one body that reads well on LinkedIn/Facebook and
// trust Buffer to truncate appropriately on Twitter.
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

// Create a single post on one channel via the createPost mutation.
// Returns the post id on success. Errors out cleanly so the
// shareBlogPost wrapper can collect partial-success results.
async function createPostOnChannel(
  { channelId, text, link, imageUrl },
  { now = true, token }
) {
  // Build the asset list. Buffer's CreatePostInput requires an
  // assets array (NON_NULL). For a link share with a featured
  // image we send a single { link: { url, title, description,
  // thumbnailUrl } } asset — the thumbnailUrl carries the picture.
  const linkAsset = {
    link: {
      url: link.url,
      title: String(link.title || '').slice(0, 120),
      description: String(link.description || '').slice(0, 240),
      thumbnailUrl: imageUrl || null,
    },
  };
  const variables = {
    input: {
      channelId,
      schedulingType: 'automatic',
      mode: now ? 'shareNow' : 'addToQueue',
      text,
      assets: [linkAsset],
      source: 'profirmo-ai-blog',
      aiAssisted: true,
    },
  };
  const data = await gqlRequest(
    `mutation ($input: CreatePostInput!) {
       createPost(input: $input) {
         __typename
         ... on PostActionSuccess { post { id } }
       }
     }`,
    variables,
    token
  );
  const res = data && data.createPost;
  if (!res) throw new Error('createPost returned no payload.');
  if (res.__typename !== 'PostActionSuccess' || !res.post) {
    throw new Error(
      `createPost rejected (${res.__typename || 'unknown'}).`
    );
  }
  return res.post.id;
}

/**
 * Share a freshly published blog post to every linked Buffer
 * channel. Returns
 *   { posted, channelIds, postIds, failures: [{channelId, service, error}] }
 * on success (partial success is allowed — a single bad channel
 * doesn't fail the whole share). Throws only if the token is missing
 * or the channels lookup itself fails.
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
  const channels = await listChannels();
  if (channels.length === 0) {
    return { skipped: true, reason: 'No connected Buffer channels.' };
  }

  const text = buildShareText({ title, excerpt, url, tags });
  const link = {
    url,
    title,
    description: excerpt || '',
  };

  const results = await Promise.all(
    channels.map(async (ch) => {
      try {
        const postId = await createPostOnChannel(
          { channelId: ch.id, text, link, imageUrl },
          { now, token }
        );
        return { ok: true, channelId: ch.id, service: ch.service, postId };
      } catch (err) {
        return {
          ok: false,
          channelId: ch.id,
          service: ch.service,
          error: err.message,
        };
      }
    })
  );
  const ok = results.filter((r) => r.ok);
  const failures = results
    .filter((r) => !r.ok)
    .map(({ channelId, service, error }) => ({ channelId, service, error }));
  return {
    posted: ok.length,
    channelIds: ok.map((r) => r.channelId),
    postIds: ok.map((r) => r.postId),
    services: ok.map((r) => r.service),
    failures,
  };
}

// Legacy compat — the old REST API had a "profiles" concept. Map it
// to channels so the existing /api/admin/buffer/profiles route keeps
// returning sensible data without touching its caller.
async function listProfiles() {
  const channels = await listChannels();
  return channels.map((c) => ({
    id: c.id,
    service: c.service,
    service_username: c.displayName,
    formatted_username: c.displayName,
    descriptor: c.descriptor,
  }));
}

// OAuth helpers are kept as thin no-op stubs — the new GraphQL API
// uses personal access tokens directly, no authorize-code dance —
// but the existing /api/buffer/connect + callback routes still
// import these, so we keep the export surface intact. They will
// throw when called so the routes return a clear error.
function buildAuthorizeUrl() {
  throw new Error(
    'Buffer OAuth is no longer used. Paste your personal access token directly at /admin/settings → AI / Anthropic → Buffer access token.'
  );
}
async function exchangeCodeForToken() {
  throw new Error('Buffer OAuth is no longer used.');
}

module.exports = {
  isConfigured,
  listProfiles,
  listChannels,
  shareBlogPost,
  buildShareText,
  buildAuthorizeUrl,
  exchangeCodeForToken,
};
