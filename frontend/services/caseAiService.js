// caseAiService — frontend wrapper for /api/cases/:id/ai/*. Drives
// the floating AI Clerk panel on the case detail page.

import { get, post, API_BASE_URL, getAccessToken } from '@/services/api';

function unwrap(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

export async function summarizeCase(caseId) {
  const res = await post(
    `/api/cases/${encodeURIComponent(caseId)}/ai/summarize`,
    {}
  );
  return unwrap(res);
}

export async function suggestNextStep(caseId) {
  const res = await post(
    `/api/cases/${encodeURIComponent(caseId)}/ai/suggest-next-step`,
    {}
  );
  return unwrap(res);
}

export async function aiPrompt(caseId, instruction) {
  const res = await post(
    `/api/cases/${encodeURIComponent(caseId)}/ai/prompt`,
    { instruction }
  );
  return unwrap(res);
}

export async function saveAiResponseAsUpdate(caseId, { title, body }) {
  const res = await post(
    `/api/cases/${encodeURIComponent(caseId)}/ai/save-as-update`,
    { title, body }
  );
  return unwrap(res);
}

export async function listAnalysableDocuments(caseId) {
  const res = await get(`/api/cases/${encodeURIComponent(caseId)}/ai/documents`);
  const data = unwrap(res);
  return Array.isArray(data) ? data : [];
}

export async function analyseDocument(caseId, documentId) {
  const res = await post(
    `/api/cases/${encodeURIComponent(caseId)}/ai/analyse-document`,
    { documentId }
  );
  return unwrap(res);
}

/**
 * One-shot OCR + analysis of a file the pro just picked from disk —
 * no persistence in S3. We bypass the shared api.js helpers because
 * they always set a JSON Content-Type, which would clobber the
 * multipart boundary multer needs on the server side.
 */
export async function analyseUploadedDocument(caseId, file) {
  const fd = new FormData();
  fd.append('file', file);
  const token = getAccessToken();
  const resp = await fetch(
    `${API_BASE_URL}/api/cases/${encodeURIComponent(caseId)}/ai/analyse-uploaded`,
    {
      method: 'POST',
      headers: token ? { authorization: `Bearer ${token}` } : {},
      credentials: 'include',
      body: fd,
    }
  );
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(json.message || 'Document analysis failed');
  }
  return unwrap(json);
}
