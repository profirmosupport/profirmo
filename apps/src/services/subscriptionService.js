import { apiGet, apiPost, unwrap } from './api';

export async function listPublicPlans() {
  const res = await apiGet('/api/subscription-plans');
  const data = unwrap(res);
  return (data && data.items) || [];
}

export async function getMySubscription() {
  const res = await apiGet('/api/subscriptions/me');
  const data = unwrap(res);
  return (data && data.subscription) || null;
}

export async function getMyUsage() {
  const res = await apiGet('/api/subscriptions/usage');
  const data = unwrap(res);
  return (data && data.usage) || null;
}

export async function listMySubscriptionPayments() {
  const res = await apiGet('/api/subscriptions/payments/mine');
  const data = unwrap(res);
  return (data && data.items) || [];
}

// NOTE: opening Razorpay Checkout requires the JS SDK loaded in a
// WebView — out of scope for the first cut. The dashboard surfaces the
// Razorpay short_url so users can complete payment in the browser.
export async function upgradeSubscription(planSlug, billingCycle = 'monthly') {
  const res = await apiPost('/api/subscriptions/upgrade', {
    planSlug,
    billingCycle,
  });
  const data = unwrap(res);
  return (data && data.subscription) || null;
}
