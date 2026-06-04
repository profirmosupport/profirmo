// attestrService — frontend wrapper for /api/attestr (backend proxy
// to https://api.attestr.com). The Attestr token never leaves the
// backend; this client only knows the proxy path.

import { get, post } from '@/services/api';

function unwrap(res) {
  if (res && Object.prototype.hasOwnProperty.call(res, 'data')) return res.data;
  return res;
}

/** Allowed Attestr `courtType` values. Small + stable, so the form can
 *  render without an extra round-trip; the backend exposes the same
 *  list at /api/attestr/court-types for parity. */
export const COURT_TYPES = [
  { value: 'DC', label: 'DC — District Court' },
  { value: 'HC', label: 'HC — High Court' },
  { value: 'SC', label: 'SC — Supreme Court' },
  { value: 'CC', label: 'CC — Consumer Court' },
  { value: 'NCLT', label: 'NCLT — National Company Law Tribunal' },
  { value: 'NCLAT', label: 'NCLAT — NCLT Appellate Tribunal' },
  { value: 'GSTAT', label: 'GSTAT — GST Appellate Tribunal' },
  { value: 'DRT', label: 'DRT — Debt Recovery Tribunal' },
  { value: 'DRAT', label: 'DRAT — DRT Appellate Tribunal' },
];

export async function fetchUnifiedCase(body) {
  const res = await post('/api/attestr/unified-case', body);
  return unwrap(res);
}

export async function fetchCourtTypes() {
  const res = await get('/api/attestr/court-types');
  const data = unwrap(res) || {};
  return data.items || [];
}
