import { apiDelete, apiGet, apiPatch, apiPost, unwrap } from './api';

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

// POST /api/cases/:id/updates — append a new update entry.
// Body: { title?, body, scheduledAt?, nextHearingDate?, attachments? }.
export async function addCaseUpdate(id, payload) {
  const res = await apiPost(`/api/cases/${id}/updates`, payload);
  return unwrap(res);
}

// PATCH /api/cases/:id/updates/:updateId — edit an existing update.
export async function editCaseUpdate(id, updateId, payload) {
  const res = await apiPatch(
    `/api/cases/${id}/updates/${updateId}`,
    payload
  );
  return unwrap(res);
}

// DELETE /api/cases/:id/updates/:updateId — remove an update.
export async function deleteCaseUpdate(id, updateId) {
  const res = await apiDelete(`/api/cases/${id}/updates/${updateId}`);
  return unwrap(res);
}

// Activity audit log (newest first).
export async function listCaseLog(id) {
  const res = await apiGet(`/api/cases/${id}/log`);
  const data = unwrap(res);
  return Array.isArray(data) ? data : (data && data.items) || [];
}

// POST /api/cases — create a new case. Backend validates title +
// category as required. Accepts a single clientId or a clientIds[]
// array; ditto professionalIds. Returns the created case.
export async function createCase(payload) {
  const res = await apiPost('/api/cases', payload);
  return unwrap(res);
}

// Delete a case. Backend gates this: clients may delete only their
// own cases AND only when no professional is assigned yet (eCourts
// imports the client just saved, basically). Errors bubble up with a
// human-readable message from the server.
export async function deleteCase(id) {
  const res = await apiDelete(`/api/cases/${id}`);
  return unwrap(res);
}

// PATCH /api/cases/:id — update case fields (title, description,
// priority, category, caseNumber, cnr, courtName, opposingParty,
// nextHearingDate, etc.). Backend enforces RBAC.
export async function updateCase(id, payload) {
  const res = await apiPatch(`/api/cases/${id}`, payload);
  return unwrap(res);
}

// PATCH /api/cases/:id/stage — change the case stage. Web stage
// tracker uses this with optimistic UI.
export async function updateCaseStage(id, stage) {
  const res = await apiPatch(`/api/cases/${id}/stage`, { stage });
  return unwrap(res);
}

// POST /api/cases/:id/leave — remove the calling professional from a
// firm-shared case. Backend returns 422 if the user is the only
// assignee left (use delete instead).
export async function leaveCase(id) {
  const res = await apiPost(`/api/cases/${id}/leave`, {});
  return unwrap(res);
}

// GET /api/cases/stages — canonical stage list (used by the stage
// tracker stepper). Order matters here.
export async function listCaseStages() {
  const res = await apiGet('/api/cases/stages');
  const data = unwrap(res);
  return Array.isArray(data) ? data : (data && data.items) || [];
}

// POST /api/cases/:id/sync-ecourts — refresh case data from the
// eCourts India bridge. Returns { case, diff } where diff carries
// newHearings, newOrders and fieldChanges arrays.
export async function syncCaseFromEcourts(id) {
  const res = await apiPost(`/api/cases/${id}/sync-ecourts`, {});
  return unwrap(res);
}

// PATCH /api/cases/:id/notes/:noteId — edit a note. Body: { body,
// attachments? }.
export async function editCaseNote(id, noteId, payload) {
  const res = await apiPatch(`/api/cases/${id}/notes/${noteId}`, payload);
  return unwrap(res);
}

// DELETE /api/cases/:id/notes/:noteId — remove a note.
export async function deleteCaseNote(id, noteId) {
  const res = await apiDelete(`/api/cases/${id}/notes/${noteId}`);
  return unwrap(res);
}
