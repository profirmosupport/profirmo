import { apiGet, unwrap } from './api';

// Public professional listing — used by clients + guests to find a
// professional. Mirrors the web /professionals catalog page.

export async function listProfessionals({
  search,
  city,
  professionalType,
  // Comma-separated list (or array) of sub-category ids. Maps to the
  // backend's `subCategoryIdsAny` filter — a professional matches if
  // ANY of their listed sub-categories appears in the set.
  subCategoryIds,
  page,
  limit,
} = {}) {
  const subCategoryIdsAny = Array.isArray(subCategoryIds)
    ? subCategoryIds.join(',')
    : subCategoryIds;
  const res = await apiGet('/api/professionals', {
    query: {
      search,
      city,
      professionalType,
      subCategoryIdsAny: subCategoryIdsAny || undefined,
      page,
      limit,
    },
  });
  // Pagination meta lives at the envelope level (`res.meta`); `data`
  // is either a bare array (legacy listings) or `{ items }`.
  const data = res && res.data;
  const items = Array.isArray(data) ? data : (data && data.items) || [];
  const meta = (res && res.meta) || {};
  return { items, meta };
}

export async function getProfessional(id) {
  const res = await apiGet(`/api/professionals/${id}`);
  return unwrap(res);
}

export async function listFirmsPublic({ search, city, page, limit } = {}) {
  const res = await apiGet('/api/firms', {
    query: { search, city, page, limit },
  });
  const data = res && res.data;
  const items = Array.isArray(data) ? data : (data && data.items) || [];
  const meta = (res && res.meta) || {};
  return { items, meta };
}
