// clientDocumentService — wraps /api/client-documents/* on the
// frontend. Upload uses FormData (multipart) because we delegate the
// actual file handling to multer + storageService on the backend.

import { get, post, patch, del, API_BASE_URL, getAccessToken } from '@/services/api';

function unwrap(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

export async function listForClient(clientUserId) {
  const res = await get(
    `/api/client-documents/by-client/${encodeURIComponent(clientUserId)}`
  );
  const data = unwrap(res);
  return Array.isArray(data) ? data : [];
}

/**
 * Upload a file for a client. `file` is a File from a <input type="file">
 * or a drag-and-drop event. We use fetch directly with FormData because
 * our shared api.js helpers wrap JSON bodies, which would clobber the
 * multipart Content-Type boundary multer needs.
 */
export async function uploadDocument(clientUserId, file, meta = {}) {
  const fd = new FormData();
  fd.append('file', file);
  if (meta.docKey) fd.append('docKey', meta.docKey);
  if (meta.label) fd.append('label', meta.label);
  if (meta.notes) fd.append('notes', meta.notes);

  const token = getAccessToken();
  const resp = await fetch(
    `${API_BASE_URL}/api/client-documents/by-client/${encodeURIComponent(clientUserId)}/upload`,
    {
      method: 'POST',
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: fd,
    }
  );
  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(json.message || 'Upload failed');
  }
  return unwrap(json);
}

export async function getDocumentUrl(docId) {
  const res = await get(
    `/api/client-documents/${encodeURIComponent(docId)}/url`
  );
  return unwrap(res);
}

export async function deleteDocument(docId) {
  const res = await del(`/api/client-documents/${encodeURIComponent(docId)}`);
  return unwrap(res);
}

// --- Access ---------------------------------------------------------

export async function requestAccess(clientUserId, note) {
  const res = await post(
    `/api/client-documents/access/by-client/${encodeURIComponent(clientUserId)}/request`,
    { note }
  );
  return unwrap(res);
}

export async function getProAccessForClient(clientUserId) {
  const res = await get(
    `/api/client-documents/access/by-client/${encodeURIComponent(clientUserId)}`
  );
  return unwrap(res);
}

export async function decideAccess(accessId, decision, note) {
  const res = await patch(
    `/api/client-documents/access/${encodeURIComponent(accessId)}`,
    { decision, note }
  );
  return unwrap(res);
}

export async function listMyAccessAsClient() {
  const res = await get('/api/client-documents/access/mine/client');
  const data = unwrap(res);
  return Array.isArray(data) ? data : [];
}

export async function listMyAccessAsPro() {
  const res = await get('/api/client-documents/access/mine/pro');
  const data = unwrap(res);
  return Array.isArray(data) ? data : [];
}
