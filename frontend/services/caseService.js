// Case service — wraps the /api/cases endpoints. Cases can be assigned to a
// professional, scoped to a firm, and carry notes + an audit log.

import { get, post, patch, del } from '@/services/api';
import { API_ENDPOINTS } from '@/utils/constants';

const BASE = API_ENDPOINTS.cases;

function unwrap(res) {
  if (res && Object.prototype.hasOwnProperty.call(res, 'data')) {
    return res.data;
  }
  return res;
}

/** List cases, optionally filtered via query params. */
export function getAll(params = {}) {
  return get(BASE, { params });
}

/** Fetch a single case by id. */
export async function getById(id) {
  const res = await get(`${BASE}/${id}`);
  return unwrap(res);
}

/** Create a new case. `professionalId` is optional — a firm can create unassigned. */
export async function create(data) {
  const res = await post(BASE, data);
  return unwrap(res);
}

/** Update an existing case (status, priority, assignment, descriptive fields). */
export async function update(id, data) {
  const res = await patch(`${BASE}/${id}`, data);
  return unwrap(res);
}

/** List available stage pipelines (civil_suit, criminal, writ, etc.). */
export async function listStagePipelines() {
  const res = await get(`${BASE}/pipelines`);
  const data = unwrap(res);
  return Array.isArray(data) ? data : [];
}

/**
 * Update the case's stage / pipeline. Either field may be sent
 * independently — setting only `stageType` resets `stage` to the
 * first step of that pipeline server-side.
 */
export async function setStage(id, { stageType, stage } = {}) {
  const res = await patch(`${BASE}/${id}/stage`, { stageType, stage });
  return unwrap(res);
}

/** Delete a case (auth required). */
export async function remove(id) {
  const res = await del(`${BASE}/${id}`);
  return unwrap(res);
}

/** Cases assigned to the logged-in professional. */
export async function getMyCases() {
  const res = await get(`${BASE}/mine`);
  return unwrap(res) || [];
}

/** Cases where the logged-in user is the client. */
export async function getMyClientCases() {
  const res = await get(`${BASE}/mine-as-client`);
  return unwrap(res) || [];
}

/** Cases for the caller's firm — `{ firmId, items }`. */
export async function getFirmCases() {
  const res = await get(`${BASE}/firm`);
  return unwrap(res) || { firmId: null, items: [] };
}

/** Notes thread on a case (newest first). */
export async function listNotes(id) {
  const res = await get(`${BASE}/${id}/notes`);
  return unwrap(res) || [];
}

/** Append a note to a case — body is either a string (back-compat) or
 *  `{ body, attachments? }`. */
export async function addNote(id, payload) {
  const data =
    typeof payload === 'string' || payload === null || payload === undefined
      ? { body: payload }
      : payload;
  const res = await post(`${BASE}/${id}/notes`, data);
  return unwrap(res);
}

/** Audit-log entries for a case (newest first). */
export async function listLog(id) {
  const res = await get(`${BASE}/${id}/log`);
  return unwrap(res) || [];
}

/** Updates (rich notes with date/time + attachments) for a case. */
export async function listUpdates(id) {
  const res = await get(`${BASE}/${id}/updates`);
  return unwrap(res) || [];
}

/** Add an update — `{ title?, body, scheduledAt?, nextHearingDate?, attachments? }`. */
export async function addUpdate(id, data) {
  const res = await post(`${BASE}/${id}/updates`, data);
  return unwrap(res);
}

/** Edit an existing update — partial body of the same fields as addUpdate. */
export async function editUpdate(caseId, updateId, data) {
  const res = await patch(`${BASE}/${caseId}/updates/${updateId}`, data);
  return unwrap(res);
}

/** Delete an update. */
export async function deleteUpdate(caseId, updateId) {
  const res = await del(`${BASE}/${caseId}/updates/${updateId}`);
  return unwrap(res);
}

/** Edit an existing note's body and/or attachments. */
export async function editNote(caseId, noteId, payload) {
  // Back-compat: callers used to pass the new body string directly.
  const body =
    typeof payload === 'string' || payload === null || payload === undefined
      ? { body: payload }
      : payload;
  const res = await patch(`${BASE}/${caseId}/notes/${noteId}`, body);
  return unwrap(res);
}

/** Delete a note. */
export async function deleteNote(caseId, noteId) {
  const res = await del(`${BASE}/${caseId}/notes/${noteId}`);
  return unwrap(res);
}

/** Fetch all cases for a given client. */
export function getByClient(clientId) {
  return get(BASE, { params: { clientId } });
}

/** Fetch all cases for a given professional. */
export function getByProfessional(professionalId) {
  return get(BASE, { params: { professionalId } });
}

/**
 * Resolve a case-attachment storage key into a short-lived signed URL.
 * The backend authorises against case access + verifies the key belongs
 * to this case before responding. Cached per (caseId, key) for a few
 * minutes so the same render pass doesn't fan out N HTTP calls when a
 * list shows many attachments at once.
 *
 * @returns {Promise<{ url: string, expiresAt: string, expiryMinutes: number }>}
 */
const _urlCache = new Map();
const _URL_TTL_MS = 4 * 60 * 1000; // refresh just before the 5-min server expiry
export async function getAttachmentUrl(caseId, key) {
  if (!caseId || !key) {
    throw new Error('caseId and key are required.');
  }
  const cacheKey = `${caseId}::${key}`;
  const hit = _urlCache.get(cacheKey);
  if (hit && hit.expiry > Date.now()) return hit.value;
  const res = await get(`${BASE}/${caseId}/attachments/url`, {
    params: { key },
  });
  const data = unwrap(res);
  _urlCache.set(cacheKey, {
    value: data,
    expiry: Date.now() + _URL_TTL_MS,
  });
  return data;
}

export default {
  getAll,
  getById,
  create,
  update,
  setStage,
  listStagePipelines,
  remove,
  getByClient,
  getByProfessional,
  getAttachmentUrl,
  getMyCases,
  getMyClientCases,
  getFirmCases,
  listNotes,
  addNote,
  listLog,
  listUpdates,
  addUpdate,
  editUpdate,
  deleteUpdate,
  editNote,
  deleteNote,
};
