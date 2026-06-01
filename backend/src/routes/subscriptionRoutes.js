// Public + authenticated routes for the subscription module.
// Admin CRUD lives under /api/admin/subscription-plans (adminRoutes.js).
// Mount under /api in app.js.

const express = require('express');
const subscription = require('../controllers/subscriptionController');
const { authenticate } = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validateRequest');

const router = express.Router();

// Public — no auth. The Dashboard subscription page fetches this so it can
// render plan cards before the user has signed in (useful for marketing
// surfaces too).
router.get('/subscription-plans', subscription.listPublicPlans);

// Logged-in user's current subscription.
router.get('/subscriptions/me', authenticate, subscription.getMine);

// Logged-in user's plan-vs-usage snapshot — powers quota banners.
router.get('/subscriptions/usage', authenticate, subscription.getMyUsage);

// Self-service plan switch. Auth required; the service rejects 'custom'
// plans (they must go via the support CTA).
router.post(
  '/subscriptions/upgrade',
  authenticate,
  validateBody({ planSlug: 'required' }),
  subscription.upgrade
);

// Confirm a Razorpay subscription payment on the success callback. We
// don't rely solely on the webhook — webhooks can be slow or unreachable
// on localhost, so this verifies the signature client-redirects to and
// flips the local subscription to active immediately.
router.post(
  '/subscriptions/confirm',
  authenticate,
  validateBody({
    razorpay_payment_id: 'required',
    razorpay_subscription_id: 'required',
    razorpay_signature: 'required',
  }),
  subscription.confirmPayment
);

// Logged-in user's subscription payment history (used by the
// professional payment history page).
router.get(
  '/subscriptions/payments/mine',
  authenticate,
  subscription.listMyPayments
);

module.exports = router;
