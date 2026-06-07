// Support API client. Public submit lives at /api/support/contact;
// admin endpoints under /api/admin/support.

import { get, patch, del } from '@/services/api';

function unwrap(res) {
  if (res && Object.prototype.hasOwnProperty.call(res, 'data')) return res.data;
  return res;
}

export async function adminListTickets({ page, limit, search, status } = {}) {
  const res = await get('/api/admin/support', {
    params: { page, limit, search, status },
  });
  return unwrap(res);
}

export async function adminGetTicket(id) {
  const res = await get(`/api/admin/support/${id}`);
  return unwrap(res);
}

export async function adminSetTicketStatus(id, status) {
  const res = await patch(`/api/admin/support/${id}/status`, { status });
  return unwrap(res);
}

export async function adminSetTicketNote(id, adminNote) {
  const res = await patch(`/api/admin/support/${id}/note`, { adminNote });
  return unwrap(res);
}

export async function adminDeleteTicket(id) {
  const res = await del(`/api/admin/support/${id}`);
  return unwrap(res);
}

export const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];
