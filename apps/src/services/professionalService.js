import { apiGet, unwrap } from './api';

// Public professional listing — used by clients + guests to find a
// professional. Mirrors the web /professionals catalog page.

export async function listProfessionals({
  search,
  city,
  professionalType,
  // Single sub-category id OR an array — the backend accepts either as
  // `subCategoryIdsAny` (a professional matches if ANY tagged
  // sub-category is in the set). Single ids pass through as-is.
  subCategoryIds,
  subCategoryId,
  // Admin-curated home-page surface — true filters to professionals
  // an admin has flagged Featured. Mirrors the web's home page query.
  featured,
  // 'featured' / 'rating' / 'experience' / 'fee'. Default backend
  // ordering is fine when this is omitted.
  sort,
  page,
  limit,
} = {}) {
  const subCategoryIdsAny = Array.isArray(subCategoryIds)
    ? subCategoryIds.join(',')
    : subCategoryIds || subCategoryId;
  const res = await apiGet('/api/professionals', {
    query: {
      search,
      city,
      professionalType,
      subCategoryIdsAny: subCategoryIdsAny || undefined,
      featured: featured ? 'true' : undefined,
      sort,
      page,
      limit,
    },
  });
  const data = res && res.data;
  const items = Array.isArray(data) ? data : (data && data.items) || [];
  const meta = (res && res.meta) || {};
  return { items, meta };
}

export async function getProfessional(id) {
  const res = await apiGet(`/api/professionals/${id}`);
  return unwrap(res);
}

export async function listFirmsPublic({
  search,
  city,
  featured,
  sort,
  page,
  limit,
} = {}) {
  const res = await apiGet('/api/firms', {
    query: {
      search,
      city,
      featured: featured ? 'true' : undefined,
      sort,
      page,
      limit,
    },
  });
  const data = res && res.data;
  const items = Array.isArray(data) ? data : (data && data.items) || [];
  const meta = (res && res.meta) || {};
  return { items, meta };
}
