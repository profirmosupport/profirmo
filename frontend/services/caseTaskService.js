// caseTaskService — wraps the /api/cases/:caseId/tasks endpoints + the
// flat /api/case-tasks/mine endpoint (used by the dashboard calendar).
// All routes are auth-scoped; the backend enforces case ownership.

import { get, post, patch, del } from '@/services/api';

function unwrap(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

export async function listForCase(caseId) {
  const res = await get(`/api/cases/${encodeURIComponent(caseId)}/tasks`);
  const data = unwrap(res);
  return Array.isArray(data) ? data : [];
}

export async function createForCase(caseId, payload) {
  const res = await post(
    `/api/cases/${encodeURIComponent(caseId)}/tasks`,
    payload
  );
  return unwrap(res);
}

export async function updateForCase(caseId, taskId, payload) {
  const res = await patch(
    `/api/cases/${encodeURIComponent(caseId)}/tasks/${encodeURIComponent(taskId)}`,
    payload
  );
  return unwrap(res);
}

export async function deleteForCase(caseId, taskId) {
  const res = await del(
    `/api/cases/${encodeURIComponent(caseId)}/tasks/${encodeURIComponent(taskId)}`
  );
  return unwrap(res);
}

export async function reorderForCase(caseId, orderedIds) {
  const res = await post(
    `/api/cases/${encodeURIComponent(caseId)}/tasks/reorder`,
    { orderedIds }
  );
  const data = unwrap(res);
  return Array.isArray(data) ? data : [];
}

/**
 * List the caller's open + in_progress tasks across every case they
 * participate in, optionally constrained to a date window.
 */
export async function listMineUpcoming(window = {}) {
  const params = {};
  if (window.from) params.from = window.from;
  if (window.to) params.to = window.to;
  const res = await get('/api/case-tasks/mine', { params });
  const data = unwrap(res);
  return Array.isArray(data) ? data : [];
}
