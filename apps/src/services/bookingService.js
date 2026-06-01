import { apiGet, apiPost, unwrap } from './api';

// Bookings for both sides. The backend automatically scopes the list to
// the caller (client sees their bookings, professional sees ones
// assigned to them).

export async function listMyBookings() {
  const res = await apiGet('/api/bookings/mine');
  const data = unwrap(res);
  return (data && data.items) || data || [];
}

export async function getBooking(id) {
  const res = await apiGet(`/api/bookings/${id}`);
  return unwrap(res);
}

export async function createBooking(payload) {
  const res = await apiPost('/api/bookings', payload);
  return unwrap(res);
}
