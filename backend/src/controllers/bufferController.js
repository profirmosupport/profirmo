// bufferController — admin-only endpoints for the Buffer.com OAuth
// flow and one-off share testing.
//
// Flow:
//   1. Admin saves buffer_client_id + buffer_client_secret in
//      /admin/settings.
//   2. Admin visits /api/admin/buffer/oauth-start (mounted under the
//      authenticated admin router). Backend builds the Buffer
//      authorize URL with a signed `state` token + the registered
//      redirect_uri and 302s the browser there.
//   3. Buffer prompts the admin to grant access to their profiles.
//   4. Buffer 302s back to /api/admin/buffer/oauth-callback?code=…&state=…
//   5. We verify the state HMAC, exchange the code for an
//      access_token, store it in admin_settings, then 302 the admin
//      back to /admin/settings with a success flag in the query.
//
// A separate POST /api/admin/buffer/share-test/:postId triggers a
// one-off share of an existing post via bufferService.shareBlogPost
// — handy for verifying the integration before the next cron run.

const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const bufferService = require('../services/bufferService');
const adminSettings = require('../services/adminSettingsService');
const BlogPost = require('../models/BlogPost');
const env = require('../config/env');

// State token: ties the eventual callback back to the admin who
// initiated it. HMAC-signed with the platform's session secret so a
// malicious party can't forge it. 10-min validity.
const STATE_TTL_MS = 10 * 60 * 1000;

function getStateSecret() {
  return (
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.APP_SECRET ||
    'profirmo-buffer-oauth'
  );
}

function signState(userId) {
  const payload = `${userId || 'admin'}:${Date.now()}`;
  const sig = crypto
    .createHmac('sha256', getStateSecret())
    .update(payload)
    .digest('hex')
    .slice(0, 32);
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function verifyState(token) {
  if (!token) return false;
  let decoded;
  try {
    decoded = Buffer.from(String(token), 'base64url').toString('utf8');
  } catch {
    return false;
  }
  const parts = decoded.split(':');
  if (parts.length !== 3) return false;
  const [userId, tsRaw, sigGiven] = parts;
  const ts = Number(tsRaw);
  if (!Number.isFinite(ts) || Date.now() - ts > STATE_TTL_MS) return false;
  const sigWant = crypto
    .createHmac('sha256', getStateSecret())
    .update(`${userId}:${ts}`)
    .digest('hex')
    .slice(0, 32);
  try {
    return crypto.timingSafeEqual(Buffer.from(sigGiven), Buffer.from(sigWant));
  } catch {
    return false;
  }
}

// Build the redirect URI that Buffer will call. Must EXACTLY match
// the one registered in the Buffer app's developer dashboard.
// Mounted at /api/buffer/oauth-callback (PUBLIC route — auth would
// block the browser redirect coming back from Buffer). State HMAC
// in the URL is the security boundary instead.
function getRedirectUri(req) {
  if (process.env.BUFFER_REDIRECT_URI) return process.env.BUFFER_REDIRECT_URI;
  const host =
    req.get('x-forwarded-host') || req.get('host') || 'proapi.profirmo.com';
  const proto =
    req.get('x-forwarded-proto') || req.protocol || 'https';
  return `${proto}://${host}/api/buffer/oauth-callback`;
}

// GET /api/admin/buffer/oauth-start
// Builds the Buffer authorize URL and 302s the admin to it.
const oauthStart = asyncHandler(async (req, res) => {
  const clientId = await adminSettings.getString('buffer_client_id');
  if (!clientId) {
    throw {
      statusCode: 422,
      message:
        'Buffer Client ID not configured. Set it at /admin/settings → AI / Anthropic → Buffer OAuth Client ID first.',
    };
  }
  const redirectUri = getRedirectUri(req);
  const state = signState(req.user && req.user.id);
  const url = bufferService.buildAuthorizeUrl({
    clientId,
    redirectUri,
    state,
  });
  // Some clients call this as a fetch() and expect JSON. Sniff the
  // Accept header: if the caller wants JSON, return the URL; else
  // do a normal 302 so a plain link works too.
  if ((req.get('accept') || '').includes('application/json')) {
    return successResponse(res, 200, 'Buffer authorize URL', {
      authorizeUrl: url,
      redirectUri,
    });
  }
  return res.redirect(302, url);
});

// GET /api/admin/buffer/oauth-callback?code=…&state=…
// Exchanges the code for an access token and saves it. Mounted on
// the AUTHENTICATED admin router — the browser still has its admin
// cookies on the redirect from Buffer.
const oauthCallback = asyncHandler(async (req, res) => {
  const { code, state, error: bufferErr, error_description } = req.query || {};
  const frontendBase = (env && env.frontendUrl) || 'https://profirmo.com';
  const settingsUrl = `${frontendBase.replace(/\/$/, '')}/admin/settings`;

  if (bufferErr) {
    return res.redirect(
      302,
      `${settingsUrl}?buffer=error&detail=${encodeURIComponent(
        String(error_description || bufferErr)
      )}`
    );
  }
  if (!code) {
    return res.redirect(302, `${settingsUrl}?buffer=error&detail=missing_code`);
  }
  if (!verifyState(state)) {
    return res.redirect(
      302,
      `${settingsUrl}?buffer=error&detail=invalid_state`
    );
  }

  const [clientId, clientSecret] = await Promise.all([
    adminSettings.getString('buffer_client_id'),
    adminSettings.getString('buffer_client_secret'),
  ]);
  if (!clientId || !clientSecret) {
    return res.redirect(
      302,
      `${settingsUrl}?buffer=error&detail=missing_client_credentials`
    );
  }
  const redirectUri = getRedirectUri(req);

  try {
    const { accessToken } = await bufferService.exchangeCodeForToken({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });
    // Persist via the same setter the admin-settings PATCH endpoint
    // uses so coerce/format and any encryption side effects fire
    // consistently.
    await adminSettings.set(
      'buffer_access_token',
      accessToken,
      req.user && req.user.id
    );
    return res.redirect(302, `${settingsUrl}?buffer=connected`);
  } catch (err) {
    return res.redirect(
      302,
      `${settingsUrl}?buffer=error&detail=${encodeURIComponent(
        (err && err.message) || 'token_exchange_failed'
      )}`
    );
  }
});

// GET /api/admin/buffer/profiles — list every connected Buffer
// profile (sanity check that the token works).
const listProfiles = asyncHandler(async (req, res) => {
  const profiles = await bufferService.listProfiles();
  const slim = (Array.isArray(profiles) ? profiles : []).map((p) => ({
    id: p && p.id,
    service: p && p.service,
    serviceUsername: p && p.service_username,
    formattedUsername: p && p.formatted_username,
    avatar: p && p.avatar,
  }));
  return successResponse(res, 200, 'Buffer profiles', { profiles: slim });
});

// POST /api/admin/buffer/share-test/:postId — one-off share of an
// existing blog post. Body: { now?: boolean } (default true).
const shareTest = asyncHandler(async (req, res) => {
  const post = await BlogPost.findByPk(req.params.postId);
  if (!post) throw { statusCode: 404, message: 'Blog post not found.' };

  const publicPrefix =
    process.env.PUBLIC_BLOG_URL_PREFIX || 'https://profirmo.com/blog/';
  const url = `${publicPrefix.replace(/\/$/, '/')}${encodeURIComponent(
    post.slug
  )}`;

  // Pull tag SLUGS so the share text has clean hashtags.
  let tags = [];
  if (Array.isArray(post.tagIds) && post.tagIds.length) {
    const BlogTag = require('../models/BlogTag');
    const { Op } = require('sequelize');
    const rows = await BlogTag.findAll({
      where: { id: { [Op.in]: post.tagIds } },
      attributes: ['slug'],
    });
    tags = rows.map((r) => r.slug);
  }

  const result = await bufferService.shareBlogPost(
    {
      title: post.title,
      excerpt: post.excerpt,
      url,
      imageUrl: post.featuredImage,
      tags,
    },
    { now: req.body && req.body.now === false ? false : true }
  );
  return successResponse(res, 200, 'Buffer share test', result);
});

module.exports = {
  oauthStart,
  oauthCallback,
  listProfiles,
  shareTest,
};
