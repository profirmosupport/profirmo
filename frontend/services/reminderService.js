// reminderService — wraps the /api/reminders endpoints. All calls are
// scoped to the signed-in professional; the backend enforces ownership.

import { get, post, patch, del } from '@/services/api';

function unwrap(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

/**
 * List reminders in a date window.
 * @param {{from?: string, to?: string}} window  YYYY-MM-DD strings
 * @returns {Promise<Array>}
 */
export async function listReminders(window = {}) {
  const params = {};
  if (window.from) params.from = window.from;
  if (window.to) params.to = window.to;
  const res = await get('/api/reminders', { params });
  const data = unwrap(res);
  return Array.isArray(data) ? data : [];
}

export async function createReminder(payload) {
  const res = await post('/api/reminders', payload);
  return unwrap(res);
}

export async function updateReminder(id, payload) {
  const res = await patch(`/api/reminders/${encodeURIComponent(id)}`, payload);
  return unwrap(res);
}

export async function deleteReminder(id) {
  const res = await del(`/api/reminders/${encodeURIComponent(id)}`);
  return unwrap(res);
}
