// gmailController — HTTP layer for the Gmail OAuth + sync flow.
//
//   GET    /api/integrations/gmail/connect    -> 302 to Google consent
//   GET    /api/integrations/gmail/callback   -> handles ?code=… ?state=…
//   GET    /api/integrations/gmail/me         -> { email, lastSyncedAt }
//   POST   /api/integrations/gmail/sync       -> { matches: [...] }
//   DELETE /api/integrations/gmail            -> disconnect

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const gmailService = require('../services/gmailService');
const googleCalendarService = require('../services/googleCalendarService');
const auditService = require('../services/auditService');

// Pull the frontend origin from Origin / Referer so the callback can
// bounce back to whichever site (localhost vs profirmo.com) started
// the flow.
function frontendOriginFrom(req) {
  if (req.headers.origin) return String(req.headers.origin);
  if (req.headers.referer) {
    try {
      const u = new URL(req.headers.referer);
      return `${u.protocol}//${u.host}`;
    } catch {
      // ignore
    }
  }
  return null;
}

const connect = asyncHandler(async (req, res) => {
  const url = await gmailService.buildAuthUrl(
    req.user.id,
    frontendOriginFrom(req)
  );
  return res.redirect(url);
});

/**
 * JSON-returning variant — used by the frontend which can't follow a
 * 302 from a fetch() (CORS strips Authorization on redirects). UI gets
 * the URL and navigates the top-level window itself.
 */
const connectUrl = asyncHandler(async (req, res) => {
  const url = await gmailService.buildAuthUrl(
    req.user.id,
    frontendOriginFrom(req)
  );
  return successResponse(res, 200, 'Gmail OAuth URL', { url });
});

// Whitelist of frontend origins we'll redirect to after the OAuth
// callback. Prevents an attacker from crafting a `state` with `o` set
// to evil.com and using us as an open redirect.
const ALLOWED_FRONTEND_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://profirmo.com',
  'https://www.profirmo.com',
]);

function pickFrontendBase(req, originFromState) {
  if (originFromState && ALLOWED_FRONTEND_ORIGINS.has(originFromState)) {
    return originFromState;
  }
  // Fallback: infer from the backend's own host. localhost backend →
  // localhost frontend; proapi.profirmo.com → profirmo.com.
  const host = String(req.headers.host || '');
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    return 'http://localhost:3000';
  }
  if (host === 'proapi.profirmo.com') {
    return 'https://profirmo.com';
  }
  // Last resort: env var. Trim any trailing slash so URL building works.
  const env = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(
    /\/$/,
    ''
  );
  return env;
}

/**
 * Callback handler — Google redirects here after consent. We exchange
 * the code for tokens, persist the connection, then bounce the user
 * back to whichever frontend started the flow (origin stashed in
 * OAuth state), with a result flag in the URL so the UI can show a
 * toast.
 */
const callback = asyncHandler(async (req, res) => {
  const { code, error: oauthError, state } = req.query;

  // Peek at the origin from state up-front so error redirects also go
  // back to the right frontend.
  let originFromState = null;
  try {
    if (state) {
      const parsed = JSON.parse(Buffer.from(state, 'base64url').toString());
      originFromState = parsed.o || null;
    }
  } catch {
    /* ignore */
  }
  const frontendBase = pickFrontendBase(req, originFromState);

  if (oauthError) {
    return res.redirect(
      `${frontendBase}/dashboard/professional?gmail=error&reason=${encodeURIComponent(oauthError)}`
    );
  }
  if (!code) {
    return res.redirect(
      `${frontendBase}/dashboard/professional?gmail=error&reason=missing_code`
    );
  }
  try {
    const conn = await gmailService.exchangeCode(code, state);
    auditService.recordCreate({
      req,
      entityType: 'gmail_connection',
      entityId: conn.id,
      after: { userId: conn.userId, email: conn.email },
      summary: `Connected Gmail account ${conn.email}`,
    });
    return res.redirect(
      `${frontendBase}/dashboard/professional?gmail=connected&email=${encodeURIComponent(conn.email)}`
    );
  } catch (err) {
    return res.redirect(
      `${frontendBase}/dashboard/professional?gmail=error&reason=${encodeURIComponent(err.message || 'unknown')}`
    );
  }
});

const getMine = asyncHandler(async (req, res) => {
  const row = await gmailService.getMine(req.user.id);
  return successResponse(res, 200, 'Gmail connection status', row);
});

const sync = asyncHandler(async (req, res) => {
  const out = await gmailService.autoLinkRecentMessages(req.user.id);
  return successResponse(res, 200, 'Gmail synced', out);
});

const disconnect = asyncHandler(async (req, res) => {
  const out = await gmailService.disconnect(req.user.id);
  if (out.disconnected) {
    auditService.recordDelete({
      req,
      entityType: 'gmail_connection',
      entityId: req.user.id,
      before: { userId: req.user.id },
      summary: 'Disconnected Gmail account',
    });
  }
  return successResponse(res, 200, 'Gmail disconnected', out);
});

// Per-case Gmail listing — sender-email match against the case's
// clients + manual pin overrides for multi-case clients.
const listMessagesForCase = asyncHandler(async (req, res) => {
  const out = await gmailService.listMessagesForCase(
    req.user.id,
    req.params.caseId
  );
  return successResponse(res, 200, 'Gmail messages for case', out);
});

const pinMessage = asyncHandler(async (req, res) => {
  const row = await gmailService.pinMessageToCase(
    req.user.id,
    req.params.messageId,
    (req.body && req.body.caseId) || null
  );
  auditService.recordCreate({
    req,
    entityType: 'gmail_pin',
    entityId: row.id,
    after: { messageId: row.messageId, caseId: row.caseId },
    summary: `Gmail message ${row.messageId} pinned to case ${row.caseId}`,
  });
  return successResponse(res, 200, 'Message pinned', row);
});

const unpinMessage = asyncHandler(async (req, res) => {
  const out = await gmailService.unpinMessage(
    req.user.id,
    req.params.messageId
  );
  return successResponse(res, 200, 'Message unpinned', out);
});

// Google Calendar — pulls events for the dashboard calendar widget.
// Reuses the same Google account connection so no extra Connect click.
const listCalendarEvents = asyncHandler(async (req, res) => {
  const out = await googleCalendarService.listEventsForUser(req.user.id, {
    from: req.query.from,
    to: req.query.to,
  });
  return successResponse(res, 200, 'Google Calendar events', out);
});

module.exports = {
  connect,
  connectUrl,
  callback,
  getMine,
  sync,
  disconnect,
  listCalendarEvents,
  listMessagesForCase,
  pinMessage,
  unpinMessage,
};
