// caseAiService — mobile wrapper for /api/cases/:id/ai/*. Drives the
// floating AI Clerk drawer on the case detail screen. Mirrors the
// web's services/caseAiService.js.

import { apiGet, apiPost, unwrap } from './api';
import { API_BASE_URL } from '../config/api';
import { getItem, STORAGE_KEYS } from '../utils/storage';

export async function summarizeCase(caseId) {
  const res = await apiPost(`/api/cases/${caseId}/ai/summarize`, {});
  return unwrap(res);
}

export async function suggestNextStep(caseId) {
  const res = await apiPost(`/api/cases/${caseId}/ai/suggest-next-step`, {});
  return unwrap(res);
}

export async function aiPrompt(caseId, instruction) {
  const res = await apiPost(`/api/cases/${caseId}/ai/prompt`, { instruction });
  return unwrap(res);
}

// Save an AI response as a case update. attachments is an array of
// already-uploaded { url, name, mimeType?, size? } objects — for one-
// shot analyse-uploaded files the caller must upload them first (the
// AI panel does this on save, not on analyse).
export async function saveAiResponseAsUpdate(
  caseId,
  { title, body, attachments } = {}
) {
  const payload = { title, body };
  if (Array.isArray(attachments) && attachments.length > 0) {
    payload.attachments = attachments;
  }
  const res = await apiPost(`/api/cases/${caseId}/ai/save-as-update`, payload);
  return unwrap(res);
}

export async function listAnalysableDocuments(caseId) {
  const res = await apiGet(`/api/cases/${caseId}/ai/documents`);
  const data = unwrap(res);
  return Array.isArray(data) ? data : [];
}

export async function analyseDocument(caseId, documentId) {
  const res = await apiPost(`/api/cases/${caseId}/ai/analyse-document`, {
    documentId,
  });
  return unwrap(res);
}

// One-shot OCR + analysis of a file the pro just picked from disk — no
// persistence in S3 at this stage. The backend caches the temp blob in
// memory only, returns { storagePath, size, ...analysis }. If the pro
// later chooses "Save as update", the AI panel uploads the same file
// (via uploadService) and passes the resulting URL as the attachment.
//
// Bypasses apiPost because that forces a JSON Content-Type which
// clobbers multer's multipart boundary on the server.
export async function analyseUploadedDocument(caseId, { uri, name, type }) {
  if (!uri) throw new Error('No file selected.');
  const form = new FormData();
  const filename = name || uri.split('/').pop() || `upload-${Date.now()}.jpg`;
  form.append('file', {
    uri,
    name: filename,
    type: type || guessMimeType(filename),
  });
  const token = await getItem(STORAGE_KEYS.accessToken);
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(
    `${API_BASE_URL}/api/cases/${caseId}/ai/analyse-uploaded`,
    {
      method: 'POST',
      headers,
      body: form,
    }
  );
  const text = await res.text();
  const payload = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new Error(
      (payload && payload.message) || `Document analysis failed (${res.status})`
    );
  }
  return (payload && payload.data) || payload;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function guessMimeType(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'image/jpeg';
}
