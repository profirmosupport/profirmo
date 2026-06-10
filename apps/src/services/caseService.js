import { apiDelete, apiGet, apiPost, unwrap } from './api';

// Cases assigned to the calling PROFESSIONAL. Used by the pro
// dashboard's Cases screen.
export async function listMyCases() {
  const res = await apiGet('/api/cases/mine');
  const data = unwrap(res);
  return (data && data.items) || data || [];
}

// Cases where the calling user is the CLIENT — covers both bookings
// that opened a case and CNRs imported from the eCourts integration.
// This is what the client dashboard's "My cases" screen should pull;
// `/api/cases/mine` returns nothing for clients because it filters
// to the professional assignment side.
export async function listMyClientCases() {
  const res = await apiGet('/api/cases/mine-as-client');
  const data = unwrap(res);
  return (data && data.items) || data || [];
}

export async function getCase(id) {
  const res = await apiGet(`/api/cases/${id}`);
  return unwrap(res);
}

// Notes thread (newest first).
export async function listCaseNotes(id) {
  const res = await apiGet(`/api/cases/${id}/notes`);
  const data = unwrap(res);
  return Array.isArray(data) ? data : (data && data.items) || [];
}

// Append a note. Body shape: { body, attachments? }.
export async function addCaseNote(id, payload) {
  const data =
    typeof payload === 'string' || payload == null
      ? { body: payload }
      : payload;
  const res = await apiPost(`/api/cases/${id}/notes`, data);
  return unwrap(res);
}

// Rich updates (title + body + scheduled date + attachments).
export async function listCaseUpdates(id) {
  const res = await apiGet(`/api/cases/${id}/updates`);
  const data = unwrap(res);
  return Array.isArray(data) ? data : (data && data.items) || [];
}

// Activity audit log (newest first).
export async function listCaseLog(id) {
  const res = await apiGet(`/api/cases/${id}/log`);
  const data = unwrap(res);
  return Array.isArray(data) ? data : (data && data.items) || [];
}

// Delete a case. Backend gates this: clients may delete only their
// own cases AND only when no professional is assigned yet (eCourts
// imports the client just saved, basically). Errors bubble up with a
// human-readable message from the server.
export async function deleteCase(id) {
  const res = await apiDelete(`/api/cases/${id}`);
  return unwrap(res);
}
