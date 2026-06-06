import { apiGet, apiPost, unwrap } from './api';
import { API_BASE_URL } from '../config/api';

// CNR is 16 alphanumeric chars in the partner schema. The 12-20 window
// keeps the fallback responsive without firing on casual word searches.
export const CNR_RE = /^[A-Za-z0-9]{12,20}$/;
export function looksLikeCnr(value) {
  return CNR_RE.test(String(value || '').trim());
}

// ecourtsService — mobile wrapper around the backend's /api/ecourts/*
// proxy. The partner key lives on the server; this client only knows
// the proxy paths.

export async function searchCases(params = {}) {
  const res = await apiGet('/api/ecourts/search', { query: params });
  return unwrap(res) || { results: [], totalHits: 0 };
}

export async function getCaseByCnr(cnr) {
  const res = await apiGet(`/api/ecourts/case/${encodeURIComponent(cnr)}`);
  return unwrap(res);
}

// Build a direct URL the device can hand off to Linking.openURL — the
// backend streams the PDF with Content-Disposition so the OS browser
// or share sheet handles the download.
export function orderDownloadUrl(cnr, filename) {
  return `${API_BASE_URL}/api/ecourts/case/${encodeURIComponent(
    cnr
  )}/order/${encodeURIComponent(filename)}/download`;
}

// --- Optional: import + sync (auth required) ----------------------------

export async function getImportedCase(cnr) {
  const res = await apiGet(`/api/ecourts/cases/imported/${encodeURIComponent(cnr)}`);
  return unwrap(res) || { imported: false, caseId: null, role: null };
}

export async function importCaseFromEcourts(cnr) {
  const res = await apiPost('/api/ecourts/cases/import', { cnr });
  return unwrap(res);
}

// --- Refresh-as-add (auth required) ------------------------------------
//
// Used when a CNR-shaped query gets 0 hits in the partner search index.
// Backend POSTs /case/{cnr}/refresh upstream and polls until the case
// lands. Response: { cnr, ready, case? }.
export async function refreshAsAdd(cnr) {
  const res = await apiPost('/api/ecourts/refresh-as-add', { cnr });
  return unwrap(res) || { cnr, ready: false };
}

// --- AI summary (auth required) ----------------------------------------

export async function getOrderAi(cnr, filename) {
  const res = await apiGet(
    `/api/ecourts/case/${encodeURIComponent(cnr)}/order/${encodeURIComponent(
      filename
    )}/ai`
  );
  return unwrap(res) || { markdown: '', aiAnalysis: null };
}

// --- Causelist ----------------------------------------------------------

export async function searchCauselist(params = {}) {
  const res = await apiGet('/api/ecourts/causelist/search', { query: params });
  return unwrap(res) || { results: [], totalHits: 0 };
}

export async function listStates() {
  const res = await apiGet('/api/ecourts/court-structure/states');
  const data = unwrap(res) || {};
  return data.items || [];
}
