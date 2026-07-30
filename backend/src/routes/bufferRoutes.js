// Public Buffer.com routes. Only the OAuth callback lives here —
// Buffer redirects the admin's browser back to this URL after they
// approve the app, and the browser cannot attach our Authorization
// header during a third-party 302 redirect. Security comes from the
// HMAC-signed `state` token issued by /api/admin/buffer/oauth-start
// (which IS auth-gated), not from a JWT.
//
// Everything else (oauth-start, profiles, share-test) stays on the
// authenticated admin router.

const express = require('express');
const buffer = require('../controllers/bufferController');

const router = express.Router();

// PUBLIC: connect entry point. Top-level browser navigation works
// here because no auth header is required. See bufferController.js
// for the security model (signed state on the callback).
router.get('/connect', buffer.oauthStart);
router.get('/oauth-callback', buffer.oauthCallback);

module.exports = router;
