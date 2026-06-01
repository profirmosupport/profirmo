import { apiGet, unwrap } from './api';

// Public professional listing — used by clients to find a professional
// to book with. Mirrors the web /professionals catalog page.

export async function listProfessionals({ search, page, limit } = {}) {
  const res = await apiGet('/api/professionals', {
    query: { search, page, limit },
  });
  const data = unwrap(res);
  return data || { items: [] };
}

export async function getProfessional(id) {
  const res = await apiGet(`/api/professionals/${id}`);
  return unwrap(res);
}
