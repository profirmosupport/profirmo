// uploadService — wraps the backend's POST /api/files/upload endpoint.
// Accepts a local file URI (from expo-image-picker) + a category and
// returns the persisted file's public URL. Anonymous uploads are
// allowed during signup; once the user signs in their token is
// attached automatically by the shared API client convention.

import { API_BASE_URL } from '../config/api';
import { getItem, STORAGE_KEYS } from '../utils/storage';

/**
 * Upload a single local file (URI from image-picker) to the backend.
 * Returns the resulting upload metadata; callers should keep `.url`.
 *
 * `caseId` is required for `case_note` (file lands under
 * `case-files/<caseId>/`). `bookingId` is required for `booking_note`
 * (file lands under `booking-files/<bookingId>/`). Without the right
 * scope id the server returns 400.
 */
export async function uploadFile({
  uri,
  category = 'other',
  name,
  type,
  caseId,
  bookingId,
}) {
  if (!uri) throw new Error('No file selected.');

  const form = new FormData();
  // RN's FormData expects an object with uri / name / type.
  const filename = name || uri.split('/').pop() || `upload-${Date.now()}.jpg`;
  // Try to infer MIME type from the extension when not provided.
  const inferredType = type || guessMimeType(filename);
  form.append('file', {
    uri,
    name: filename,
    type: inferredType,
  });
  form.append('category', category);
  if (caseId) form.append('caseId', String(caseId));
  if (bookingId) form.append('bookingId', String(bookingId));

  const token = await getItem(STORAGE_KEYS.accessToken);
  const headers = {
    Accept: 'application/json',
    // Intentionally NOT setting Content-Type; fetch fills the boundary.
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/api/files/upload`, {
    method: 'POST',
    headers,
    body: form,
  });
  const text = await res.text();
  const payload = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new Error(
      (payload && payload.message) || `Upload failed (${res.status})`
    );
  }
  // Endpoint returns { success, message, data: { id, url, ... } }.
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
