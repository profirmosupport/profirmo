import { apiGet, apiPost, unwrap } from './api';

export async function listNotifications() {
  const res = await apiGet('/api/notifications');
  const data = unwrap(res);
  return (data && data.items) || data || [];
}

export async function markAllRead() {
  const res = await apiPost('/api/notifications/read-all');
  return unwrap(res);
}
