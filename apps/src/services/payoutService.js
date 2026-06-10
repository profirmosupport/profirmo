// Payout service — wraps the pro-facing payout endpoints. Submission
// lands in the admin panel's payout queue (same flow the web uses).
//   GET  /api/payouts/me/available  — withdrawable amount in paise
//   GET  /api/payouts/mine          — payout request history
//   POST /api/payouts/mine          — submit a new request

import { apiGet, apiPost, unwrap } from './api';

export async function getAvailablePayout() {
  const res = await apiGet('/api/payouts/me/available');
  const data = unwrap(res);
  return (data && data.availableForPayout) || 0;
}

export async function listMyPayouts() {
  const res = await apiGet('/api/payouts/mine');
  const data = unwrap(res);
  return (data && data.items) || [];
}

// Submit a payout request. `amount` is in paise (min 100 = ₹1).
// `method` is 'bank' or 'upi'; the other fields validate accordingly
// on the server.
export async function submitPayoutRequest({
  amount,
  method,
  bankAccountName,
  bankAccountNumber,
  bankIfsc,
  upiId,
  notes,
}) {
  const res = await apiPost('/api/payouts/mine', {
    amount,
    method,
    bankAccountName,
    bankAccountNumber,
    bankIfsc,
    upiId,
    notes,
  });
  return unwrap(res);
}
