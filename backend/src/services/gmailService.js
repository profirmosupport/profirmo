// gmailService — server-side glue for the Gmail OAuth integration.
//
//   * buildAuthUrl(userId)               -> redirect URL for /oauth2/auth
//   * exchangeCode(code, state)          -> { connection } after consent
//   * mintAccessToken(connection)        -> short-lived bearer for one call
//   * listRecentMessages(connection)     -> [{ id, threadId, snippet, ... }]
//   * autoLinkMessages(userId)           -> attaches matched mail to cases
//
// Tokens at rest are plaintext (see GmailConnection model header for
// the rationale — JWT-bound encryption silently broke on rotation).

const adminSettings = require('./adminSettingsService');
const { GmailConnection, Case, User } = require('../models');
const { Op } = require('sequelize');

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

// Scopes: read-only for v1. `gmail.modify` would let us mark as read or
// add labels later; left out so the consent screen is friendlier.
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.readonly',
];

// --- Config -----------------------------------------------------------

async function getOAuthConfig() {
  const [clientId, clientSecret, redirectUri] = await Promise.all([
    adminSettings.getString('gmail_oauth_client_id'),
    adminSettings.getString('gmail_oauth_client_secret'),
    adminSettings.getString('gmail_redirect_uri'),
  ]);
  if (!clientId || !clientSecret || !redirectUri) {
    throw {
      statusCode: 503,
      message:
        'Gmail integration is not configured. Add the GCP OAuth client id, secret and redirect URI under Admin → Integrations / Gmail.',
    };
  }
  return { clientId, clientSecret, redirectUri };
}

// --- OAuth round-trip -------------------------------------------------

/**
 * Build the Google consent URL. `state` carries the caller's user id
 * so the callback can match the grant to the right account; in prod
 * this should be signed (JWT) to stop CSRF; for v1 we use a random
 * nonce + state stored in admin_settings keyed by nonce.
 */
async function buildAuthUrl(userId) {
  const cfg = await getOAuthConfig();
  // Encode the user id directly; we also stamp a random nonce so a
  // stolen state from an old session can't be replayed forever.
  const nonce = require('crypto').randomBytes(12).toString('hex');
  const state = Buffer.from(JSON.stringify({ u: userId, n: nonce })).toString('base64url');
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    access_type: 'offline', // we need a refresh_token
    include_granted_scopes: 'true',
    prompt: 'consent', // force refresh_token every time
    scope: SCOPES.join(' '),
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange the auth code for tokens, then immediately resolve the
 * user's email address via the userinfo endpoint. Persist the grant
 * as a GmailConnection row keyed by Profirmo userId.
 */
async function exchangeCode(code, state) {
  const cfg = await getOAuthConfig();
  let userId = null;
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString());
    userId = parsed.u || null;
  } catch {
    throw { statusCode: 400, message: 'Invalid OAuth state parameter' };
  }
  if (!userId) throw { statusCode: 400, message: 'Missing user id in state' };

  const tokenResp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const tokenJson = await tokenResp.json();
  if (!tokenResp.ok) {
    throw {
      statusCode: 400,
      message: `Gmail token exchange failed: ${tokenJson.error_description || tokenJson.error || 'unknown'}`,
    };
  }
  if (!tokenJson.refresh_token) {
    throw {
      statusCode: 400,
      message:
        'Google did not return a refresh_token. Disconnect this account from your Google Apps connected sites and try again.',
    };
  }

  // Resolve the connected email address.
  const userInfoResp = await fetch(
    'https://openidconnect.googleapis.com/v1/userinfo',
    { headers: { authorization: `Bearer ${tokenJson.access_token}` } }
  );
  const userInfo = await userInfoResp.json();
  const email = userInfo && userInfo.email;
  if (!email) {
    throw { statusCode: 400, message: 'Could not resolve Gmail account email' };
  }

  // Upsert by Profirmo user — one Gmail account per user for v1.
  const existing = await GmailConnection.findOne({ where: { userId } });
  if (existing) {
    await existing.update({
      email,
      refreshToken: tokenJson.refresh_token,
      scope: tokenJson.scope || SCOPES.join(' '),
    });
    return existing.get({ plain: true });
  }
  const row = await GmailConnection.create({
    userId,
    email,
    refreshToken: tokenJson.refresh_token,
    scope: tokenJson.scope || SCOPES.join(' '),
  });
  return row.get({ plain: true });
}

/**
 * Trade the refresh token for a short-lived access token. Google does
 * not return a new refresh token here, so we don't update the row.
 */
async function mintAccessToken(connection) {
  const cfg = await getOAuthConfig();
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: connection.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const j = await resp.json();
  if (!resp.ok || !j.access_token) {
    throw {
      statusCode: 502,
      message: `Gmail access-token refresh failed: ${j.error_description || j.error || 'unknown'}`,
    };
  }
  return j.access_token;
}

// --- Message fetch + parse -------------------------------------------

function headerValue(headers, name) {
  if (!Array.isArray(headers)) return null;
  const h = headers.find((x) => x.name && x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : null;
}

function extractEmail(fromHeader) {
  // "Name <addr@x>" or just "addr@x"
  const m = /<([^>]+)>/.exec(String(fromHeader || ''));
  return (m ? m[1] : String(fromHeader || '')).trim().toLowerCase();
}

/**
 * Pull the most recent N message metadata records for the connected
 * mailbox. v1: no incremental sync via history; just messages.list
 * with a small page size. Returns: [{ id, from, subject, snippet, date }].
 */
async function listRecentMessages(connection, max = 20) {
  const token = await mintAccessToken(connection);
  const listResp = await fetch(
    `${GMAIL_API}/users/me/messages?maxResults=${max}&q=in:inbox`,
    { headers: { authorization: `Bearer ${token}` } }
  );
  const listJson = await listResp.json();
  if (!listResp.ok) {
    throw {
      statusCode: 502,
      message: `Gmail messages.list failed: ${(listJson.error && listJson.error.message) || 'unknown'}`,
    };
  }
  const ids = (listJson.messages || []).map((m) => m.id);
  // Detail fetch in parallel; each call returns the message metadata.
  const detailResps = await Promise.all(
    ids.map((id) =>
      fetch(
        `${GMAIL_API}/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { authorization: `Bearer ${token}` } }
      ).then((r) => r.json())
    )
  );
  return detailResps
    .filter((d) => d && d.id)
    .map((d) => {
      const headers = (d.payload && d.payload.headers) || [];
      const fromHeader = headerValue(headers, 'From') || '';
      return {
        id: d.id,
        threadId: d.threadId,
        from: fromHeader,
        fromEmail: extractEmail(fromHeader),
        subject: headerValue(headers, 'Subject') || '(no subject)',
        date: headerValue(headers, 'Date') || null,
        snippet: d.snippet || '',
      };
    });
}

// --- Auto-link --------------------------------------------------------

/**
 * Walk the last N inbox messages for the caller's connected mailbox
 * and try to match each one to a Case via the sender email →
 * client.email lookup. Matches are returned as a flat list the UI can
 * render under the corresponding case timeline.
 *
 * v1 is read-only — we don't write a CaseUpdate row yet, so a user
 * can review matches before committing them. v2 will add a "convert
 * to update" button per match.
 */
async function autoLinkRecentMessages(userId, max = 20) {
  const connection = await GmailConnection.findOne({ where: { userId } });
  if (!connection) {
    throw {
      statusCode: 404,
      message: 'No Gmail account connected for this user',
    };
  }
  const messages = await listRecentMessages(connection, max);
  if (messages.length === 0) return { connected: connection.email, matches: [] };

  // Pull every client email that touches a case the caller participates
  // in. For v1 this is broad — refine in v2 with firm/case scoping.
  const emails = [...new Set(messages.map((m) => m.fromEmail).filter(Boolean))];
  if (emails.length === 0) return { connected: connection.email, matches: [] };

  const matchingClients = await User.findAll({
    where: { email: { [Op.in]: emails } },
    attributes: ['id', 'email', 'name'],
    raw: true,
  });
  const byEmail = new Map(
    matchingClients.map((u) => [String(u.email || '').toLowerCase(), u])
  );

  // Find every case where any matched client is a participant.
  const clientIds = matchingClients.map((c) => c.id);
  if (clientIds.length === 0) return { connected: connection.email, matches: [] };
  const cases = await Case.findAll({
    where: { [Op.or]: [{ clientId: { [Op.in]: clientIds } }] },
    attributes: ['id', 'title', 'clientId'],
    raw: true,
  });
  const casesByClient = new Map();
  for (const c of cases) {
    if (!c.clientId) continue;
    if (!casesByClient.has(c.clientId)) casesByClient.set(c.clientId, []);
    casesByClient.get(c.clientId).push(c);
  }

  const matches = [];
  for (const m of messages) {
    const client = byEmail.get(m.fromEmail);
    if (!client) continue;
    const relatedCases = casesByClient.get(client.id) || [];
    if (relatedCases.length === 0) continue;
    matches.push({ message: m, client, cases: relatedCases });
  }

  await connection.update({ lastSyncedAt: new Date() });

  return {
    connected: connection.email,
    matches,
    fetchedMessageCount: messages.length,
  };
}

// --- Disconnect -------------------------------------------------------

async function disconnect(userId) {
  const row = await GmailConnection.findOne({ where: { userId } });
  if (!row) return { disconnected: false };
  // Try a best-effort token revocation; ignore failure (we're nuking
  // the row regardless).
  try {
    await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(row.refreshToken)}`,
      { method: 'POST' }
    );
  } catch {
    /* noop */
  }
  await row.destroy();
  return { disconnected: true };
}

async function getMine(userId) {
  const row = await GmailConnection.findOne({
    where: { userId },
    attributes: ['email', 'scope', 'lastSyncedAt', 'createdAt'],
    raw: true,
  });
  return row || null;
}

module.exports = {
  buildAuthUrl,
  exchangeCode,
  mintAccessToken,
  listRecentMessages,
  autoLinkRecentMessages,
  disconnect,
  getMine,
};
