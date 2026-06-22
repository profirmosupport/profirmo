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
const auditService = require('../services/auditService');

const connect = asyncHandler(async (req, res) => {
  const url = await gmailService.buildAuthUrl(req.user.id);
  return res.redirect(url);
});

/**
 * JSON-returning variant — used by the frontend which can't follow a
 * 302 from a fetch() (CORS strips Authorization on redirects). UI gets
 * the URL and navigates the top-level window itself.
 */
const connectUrl = asyncHandler(async (req, res) => {
  const url = await gmailService.buildAuthUrl(req.user.id);
  return successResponse(res, 200, 'Gmail OAuth URL', { url });
});

/**
 * Callback handler — Google redirects here after consent. We exchange
 * the code for tokens, persist the connection, then bounce the user
 * back to the dashboard with a result flag in the URL so the UI can
 * show a toast.
 */
const callback = asyncHandler(async (req, res) => {
  const { code, error: oauthError, state } = req.query;
  const frontendBase =
    process.env.FRONTEND_URL || 'http://localhost:3000';
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

module.exports = { connect, connectUrl, callback, getMine, sync, disconnect };
