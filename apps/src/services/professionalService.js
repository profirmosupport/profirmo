import { apiGet, unwrap } from './api';

// Public professional listing — used by clients + guests to find a
// professional. Mirrors the web /professionals catalog page.

export async function listProfessionals({
  search,
  city,
  professionalType,
  category,
  page,
  limit,
} = {}) {
  const res = await apiGet('/api/professionals', {
    query: { search, city, professionalType, category, page, limit },
  });
  const data = unwrap(res);
  if (Array.isArray(data)) return { items: data };
  return data || { items: [] };
}

export async function getProfessional(id) {
  const res = await apiGet(`/api/professionals/${id}`);
  return unwrap(res);
}

export async function listFirmsPublic({ search, city, page, limit } = {}) {
  const res = await apiGet('/api/firms', {
    query: { search, city, page, limit },
  });
  const data = unwrap(res);
  if (Array.isArray(data)) return { items: data };
  return data || { items: [] };
}
