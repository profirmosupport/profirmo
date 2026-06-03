import { apiGet, apiPost, unwrap } from './api';

export async function listMyPayments(side = 'any') {
  const res = await apiGet('/api/payments/mine', { query: { side } });
  const data = unwrap(res);
  return (data && data.items) || [];
}

export async function getPayment(id) {
  const res = await apiGet(`/api/payments/${id}`);
  return unwrap(res);
}

// Create a Razorpay order on the backend for an existing booking. The
// response carries { order, payment, keyId } — `keyId` is the public
// Razorpay key safe to use on the client side to boot Checkout.
export async function createBookingOrder(bookingId) {
  const res = await apiPost('/api/payments/orders', { bookingId });
  return unwrap(res);
}

// Verify the signature returned by Razorpay's success handler. Backend
// flips the booking to confirmed + records the escrow inside one
// transaction. Throws on signature mismatch.
export async function verifyBookingPayment({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) {
  const res = await apiPost('/api/payments/verify', {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });
  return unwrap(res);
}
