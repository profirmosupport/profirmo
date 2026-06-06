// ecourtsService — frontend wrapper for /api/ecourts (backend proxy
// to https://webapi.ecourtsindia.com). The partner API key lives on
// the backend; this client never sees it.

import { get, post, del, API_BASE_URL } from '@/services/api';

// CNR validation — partner schema is 16 alphanumeric chars (e.g.
// `UPHC052793522026`). We use a slightly loose 12-20 window so the
// fallback kicks in for the occasional non-standard length CNR but
// doesn't fire for casual searches.
export const CNR_RE = /^[A-Za-z0-9]{12,20}$/;
export function looksLikeCnr(value) {
  return CNR_RE.test(String(value || '').trim());
}

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

// --- Refresh-as-add (auth required) ------------------------------------
//
// Triggered when a CNR-shaped query returns 0 hits in the partner search
// index. Backend POSTs upstream /case/{cnr}/refresh and returns IMMEDIATELY
// with the queue envelope. Shape:
//   { cnr, ready: true,  case }   — partner already had the case cached
//   { cnr, ready: false, queue }  — queued; client should poll
// Upstream estimates 5–10 minutes for unknown CNRs so the client is in
// charge of polling /api/ecourts/case/{cnr} until it lands.
export async function refreshAsAdd(cnr) {
  const res = await post('/api/ecourts/refresh-as-add', { cnr });
  return unwrap(res) || { cnr, ready: false };
}

// --- AI summary (auth required) ----------------------------------------
//
// Slow on first hit per file (the upstream API OCRs + LLM-summarises,
// 10-60s typical). Subsequent hits are fast. Response shape:
//   { markdown: string, aiAnalysis: { summary, keyPoints, outcome, relief, statutes } }
export async function getOrderAi(cnr, filename) {
  const res = await get(
    `/api/ecourts/case/${encodeURIComponent(cnr)}/order/${encodeURIComponent(
      filename
    )}/ai`
  );
  return unwrap(res) || { markdown: '', aiAnalysis: null };
}

// --- Free taxonomy ------------------------------------------------------

export async function listStates() {
  const res = await get('/api/ecourts/court-structure/states');
  const data = unwrap(res) || {};
  return data.items || [];
}

export async function listDistricts(state) {
  const res = await get(
    `/api/ecourts/court-structure/states/${encodeURIComponent(state)}/districts`
  );
  const data = unwrap(res) || {};
  return data.items || [];
}

// --- Causelist ----------------------------------------------------------

export async function searchCauselist(params) {
  const res = await get('/api/ecourts/causelist/search', { params });
  return unwrap(res) || { results: [], totalHits: 0 };
}

export async function causelistAvailableDates(params) {
  const res = await get('/api/ecourts/causelist/available-dates', { params });
  return unwrap(res) || { dates: [] };
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
