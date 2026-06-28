// integrationsRoutes — umbrella router for third-party integration
// endpoints. Today: Gmail only. Future: WhatsApp, IRP e-invoice, etc.
//
// The /callback endpoint is intentionally NOT behind authenticate
// because Google redirects the user's browser there directly after
// consent (no JWT in the URL). State carries the user id + a nonce so
// the controller can still associate the grant with the right account.

const express = require('express');
const gmailController = require('../controllers/gmailController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// Public (no JWT) — but signed via state param.
router.get('/gmail/callback', gmailController.callback);

// Authenticated routes — everything else.
router.use(authenticate);
router.get('/gmail/connect', gmailController.connect);
router.get('/gmail/connect/url', gmailController.connectUrl);
router.get('/gmail/me', gmailController.getMine);
router.post('/gmail/sync', gmailController.sync);
router.delete('/gmail', gmailController.disconnect);

// Per-case Gmail listing + manual pinning (multi-case-per-client
// disambiguation).
router.get(
  '/gmail/case/:caseId/messages',
  gmailController.listMessagesForCase
);
router.post(
  '/gmail/messages/:messageId/pin',
  gmailController.pinMessage
);
router.delete(
  '/gmail/messages/:messageId/pin',
  gmailController.unpinMessage
);

// Google Calendar — reuses the Gmail OAuth grant; surfaces events on
// the dashboard calendar widget.
router.get('/google/calendar/events', gmailController.listCalendarEvents);
router.post('/google/calendar/sync-all', gmailController.syncCalendarAll);

module.exports = router;
