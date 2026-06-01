// subscriptionService — wrappers for the subscription module endpoints.
// Admin CRUD lives under /api/admin/subscription-plans; public + pro
// surfaces live under /api/subscription-plans and /api/subscriptions/*.

import { get, post, patch, del } from '@/services/api';
import { loadRazorpayScript } from '@/services/paymentService';

const E = {
  list: '/api/admin/subscription-plans',
  featureKeys: '/api/admin/subscription-plans/feature-keys',
  byId: (id) => `/api/admin/subscription-plans/${id}`,
  status: (id) => `/api/admin/subscription-plans/${id}/status`,
  duplicate: (id) => `/api/admin/subscription-plans/${id}/duplicate`,
  subscribers: (id) => `/api/admin/subscription-plans/${id}/subscribers`,
  publicList: '/api/subscription-plans',
  mine: '/api/subscriptions/me',
  usage: '/api/subscriptions/usage',
  upgrade: '/api/subscriptions/upgrade',
  confirm: '/api/subscriptions/confirm',
  paymentsMine: '/api/subscriptions/payments/mine',
  razorpayConfig: '/api/auth/razorpay-config',
};

function unwrap(res) {
  return res && Object.prototype.hasOwnProperty.call(res, 'data')
    ? res.data
    : res;
}

export async function adminListPlans(params = {}) {
  const res = await get(E.list, { params });
  const data = unwrap(res);
  return (data && data.items) || [];
}

export async function adminListFeatureKeys() {
  const res = await get(E.featureKeys);
  const data = unwrap(res);
  return (data && data.items) || [];
}

export async function adminGetPlan(id) {
  const res = await get(E.byId(id));
  const data = unwrap(res);
  return (data && data.item) || null;
}

export async function adminCreatePlan(body) {
  const res = await post(E.list, body);
  const data = unwrap(res);
  return (data && data.item) || null;
}

export async function adminUpdatePlan(id, body) {
  const res = await patch(E.byId(id), body);
  const data = unwrap(res);
  return (data && data.item) || null;
}

export async function adminSetPlanStatus(id, status) {
  const res = await patch(E.status(id), { status });
  const data = unwrap(res);
  return (data && data.item) || null;
}

export async function adminDuplicatePlan(id) {
  const res = await post(E.duplicate(id));
  const data = unwrap(res);
  return (data && data.item) || null;
}

export async function adminDeletePlan(id) {
  const res = await del(E.byId(id));
  return unwrap(res);
}

export async function adminListSubscribers(id) {
  const res = await get(E.subscribers(id));
  const data = unwrap(res);
  return (data && data.items) || [];
}

// --- Public + professional surface ----------------------------------------

/**
 * Public — list every plan that should appear on the professional
 * dashboard subscription page (active + public visibility only).
 */
export async function listPublicPlans() {
  const res = await get(E.publicList);
  const data = unwrap(res);
  return (data && data.items) || [];
}

/**
 * Auth — fetch the logged-in user's active subscription + plan it links
 * to. Returns null when the user has no subscription on record.
 */
export async function getMySubscription() {
  const res = await get(E.mine);
  const data = unwrap(res);
  return (data && data.subscription) || null;
}

/**
 * Auth — return the logged-in user's plan-vs-usage snapshot. Each
 * quota dimension has shape `{ used, limit, remaining, unlimited }`.
 * `usage` is null when the user has no active subscription on file.
 */
export async function getMyUsage() {
  const res = await get(E.usage);
  const data = unwrap(res);
  return (data && data.usage) || null;
}

/**
 * Auth — switch the logged-in user to a new plan.
 *
 * For free plans the server flips the subscription instantly. For paid
 * plans the server creates a Razorpay subscription and returns
 * `subscription.razorpay = { subscriptionId, ... }` so the caller can
 * open Razorpay Checkout via {@link openSubscriptionCheckout}.
 *
 * @param {string} planSlug       Target plan's slug (e.g. 'premium').
 * @param {'monthly'|'annual'} [billingCycle='monthly']
 */
export async function upgradeSubscription(planSlug, billingCycle = 'monthly') {
  const res = await post(E.upgrade, { planSlug, billingCycle });
  const data = unwrap(res);
  return (data && data.subscription) || null;
}

/**
 * Auth — verify a Razorpay subscription payment (server-side HMAC) and
 * flip the local subscription to active. Called right after the Checkout
 * `handler` callback so the dashboard updates without waiting for the
 * Razorpay webhook (which is unreachable on localhost).
 */
export async function confirmSubscriptionPayment({
  razorpayPaymentId,
  razorpaySubscriptionId,
  razorpaySignature,
}) {
  const res = await post(E.confirm, {
    razorpay_payment_id: razorpayPaymentId,
    razorpay_subscription_id: razorpaySubscriptionId,
    razorpay_signature: razorpaySignature,
  });
  return unwrap(res) || null;
}

/**
 * Auth — list the caller's subscription payment history (paid plans
 * only). Returns rows shaped like SubscriptionPayment + a `plan` join.
 */
export async function listMySubscriptionPayments() {
  const res = await get(E.paymentsMine);
  const data = unwrap(res);
  return (data && data.items) || [];
}

// --- Razorpay subscription checkout --------------------------------------

let _razorpayConfigPromise = null;

/**
 * Fetch the public Razorpay config (just `keyId`) from the backend. Cached
 * for the page lifetime — the value rarely changes, and admins who rotate
 * it via /admin/settings will see the change on the next page load.
 */
export async function fetchRazorpayConfig() {
  if (!_razorpayConfigPromise) {
    _razorpayConfigPromise = (async () => {
      try {
        const res = await get(E.razorpayConfig);
        const data = unwrap(res);
        return data || { keyId: '', configured: false };
      } catch (err) {
        // Don't poison the cache — let the next caller retry.
        _razorpayConfigPromise = null;
        throw err;
      }
    })();
  }
  return _razorpayConfigPromise;
}

/**
 * Open Razorpay Checkout for a subscription (mandate authorisation). Once
 * the user authorises, Razorpay fires `subscription.authenticated` and
 * later `subscription.activated` webhooks server-side — the page should
 * re-poll {@link getMySubscription} after the modal closes.
 *
 * @param {object} opts
 * @param {string} opts.subscriptionId Razorpay sub_xxx id from the upgrade response.
 * @param {string} [opts.planName]      Shown in the Razorpay modal header.
 * @param {{name?:string,email?:string,phone?:string}} [opts.prefill]
 * @returns {Promise<{ paymentId?:string, subscriptionId?:string, cancelled?:boolean }>}
 */
export async function openSubscriptionCheckout({
  subscriptionId,
  planName = 'Subscription',
  prefill = {},
}) {
  if (!subscriptionId) {
    throw new Error('Razorpay subscription id is required to open checkout.');
  }
  const cfg = await fetchRazorpayConfig();
  if (!cfg.keyId) {
    throw new Error(
      'Razorpay is not configured. Ask an admin to set the key in /admin/settings.'
    );
  }
  await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    let settled = false;
    const settleResolve = (v) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const settleReject = (e) => {
      if (settled) return;
      settled = true;
      reject(e);
    };
    let lastFailure = null;

    const rzp = new window.Razorpay({
      key: cfg.keyId,
      subscription_id: subscriptionId,
      name: 'Profirmo',
      description: `${planName} — recurring subscription`,
      prefill: {
        name: prefill.name || '',
        email: prefill.email || '',
        contact: prefill.phone || '',
      },
      theme: { color: '#d97706' },
      handler: (response) => {
        // Razorpay returns razorpay_payment_id + razorpay_subscription_id
        // + razorpay_signature on subscription activation. Server-side
        // webhook is authoritative; the modal close just lets us advance
        // the UX.
        settleResolve({
          paymentId: response && response.razorpay_payment_id,
          subscriptionId: response && response.razorpay_subscription_id,
          signature: response && response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => {
          if (lastFailure) {
            settleReject(lastFailure);
            return;
          }
          settleResolve({ cancelled: true });
        },
      },
    });
    rzp.on('payment.failed', (resp) => {
      const desc =
        resp && resp.error && (resp.error.description || resp.error.reason);
      lastFailure = new Error(desc || 'Subscription payment failed.');
    });
    rzp.open();
  });
}
