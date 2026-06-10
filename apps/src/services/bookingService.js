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

// Rich booking detail — the response includes professional + client
// snapshots, payment, escrow, notes, reviews, and permissions. Powers
// the booking detail screen (same endpoint the web /dashboard/client/
// bookings/[id] page uses).
export async function getBookingDetail(id) {
  const res = await apiGet(`/api/bookings/${id}/detail`);
  return unwrap(res);
}

// Append a note (optionally with uploaded attachments). Body shape:
// { body, attachments? }. Returns the inserted note.
export async function addBookingNote(id, payload) {
  const data =
    typeof payload === 'string' || payload == null
      ? { body: payload }
      : payload;
  const res = await apiPost(`/api/bookings/${id}/notes`, data);
  return unwrap(res);
}

export async function createBooking(payload) {
  const res = await apiPost('/api/bookings', payload);
  return unwrap(res);
}
