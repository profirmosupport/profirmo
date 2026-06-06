// Newsletter API client. Public-side: subscribe + complete; admin-side:
// list / status / delete.

import { get, post, patch, del } from '@/services/api';

function unwrap(res) {
  if (res && Object.prototype.hasOwnProperty.call(res, 'data')) return res.data;
  return res;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function isValidEmail(value) {
  if (!value) return false;
  const v = String(value).trim();
  return v.length > 0 && v.length <= 255 && EMAIL_RE.test(v);
}

/**
 * Footer signup — POSTs the email. Returns `{ subscriber, isNew }`.
 * Throws with `.status` populated when the backend rejects.
 */
export async function subscribe(email) {
  const res = await post('/api/newsletter/subscribe', { email, source: 'footer' });
  return unwrap(res);
}

/**
 * Fill in the optional fields collected by the modal. Identified by
 * email — anyone can update their own row without an auth token.
 */
export async function completeProfile({ email, fullName, phone, city, interests }) {
  const res = await patch('/api/newsletter/complete', {
    email,
    fullName,
    phone,
    city,
    interests,
  });
  return unwrap(res);
}

// --- Admin --------------------------------------------------------------

export async function adminListSubscribers({ page, limit, search, status } = {}) {
  const res = await get('/api/admin/newsletter', {
    params: { page, limit, search, status },
  });
  return unwrap(res);
}

export async function adminSetSubscriberStatus(id, status) {
  const res = await patch(`/api/admin/newsletter/${id}`, { status });
  return unwrap(res);
}

export async function adminDeleteSubscriber(id) {
  const res = await del(`/api/admin/newsletter/${id}`);
  return unwrap(res);
}
