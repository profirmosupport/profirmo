// ecourtsService — frontend wrapper for /api/ecourts (backend proxy
// to https://webapi.ecourtsindia.com). The partner API key lives on
// the backend; this client never sees it.

import { get, post, del, API_BASE_URL } from '@/services/api';

function unwrap(res) {
  if (res && Object.prototype.hasOwnProperty.call(res, 'data')) return res.data;
  return res;
}

/**
 * Search cases. Pass any of: query, advocates, judges, petitioners,
 * respondents, litigants, plus pagination (page, pageSize).
 */
export async function searchCases(params = {}) {
  const res = await get('/api/ecourts/search', { params });
  return unwrap(res) || { results: [], totalHits: 0 };
}

/** Fetch a single case by its 16-char CNR. */
export async function getCaseByCnr(cnr) {
  const res = await get(`/api/ecourts/case/${encodeURIComponent(cnr)}`);
  return unwrap(res);
}

/**
 * Build a direct browser URL for downloading an order PDF. The backend
 * streams the watermarked PDF as application/pdf with the right
 * Content-Disposition header, so a plain anchor click is enough — no
 * blob() trickery needed.
 */
export function orderDownloadUrl(cnr, filename) {
  return `${API_BASE_URL}/api/ecourts/case/${encodeURIComponent(
    cnr
  )}/order/${encodeURIComponent(filename)}/download`;
}

// --- Favourites (auth required) -----------------------------------------

export async function listFavorites() {
  const res = await get('/api/ecourts/favorites');
  const data = unwrap(res) || {};
  return data.items || [];
}

export async function addFavorite(cnr, snapshot) {
  const res = await post('/api/ecourts/favorites', { cnr, snapshot });
  return unwrap(res);
}

export async function removeFavorite(cnr) {
  const res = await del(`/api/ecourts/favorites/${encodeURIComponent(cnr)}`);
  return unwrap(res);
}

// --- Import / Sync the user's own Case row ------------------------------

export async function importCaseFromEcourts(cnr) {
  const res = await post('/api/ecourts/cases/import', { cnr });
  return unwrap(res);
}

/**
 * Is the given CNR already saved in the signed-in user's own Cases
 * module? Returns { imported, caseId, role }. Used by the ECI detail
 * page to swap the "Save to my cases" CTA for "Check in my cases".
 */
export async function getImportedCase(cnr) {
  const res = await get(`/api/ecourts/cases/imported/${encodeURIComponent(cnr)}`);
  return unwrap(res) || { imported: false, caseId: null, role: null };
}

export async function syncCaseFromEcourts(caseId) {
  const res = await post(`/api/cases/${encodeURIComponent(caseId)}/sync-ecourts`);
  return unwrap(res);
}
