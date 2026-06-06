// appSettingsService — wraps the public + admin App Settings endpoints
// (categories, sub-categories, cities). Every call returns the parsed `data`
// object from the API envelope.
//
// Public reads (listCategories, listCities) require no auth.
// Admin CRUD endpoints require a `platform_admin` token, attached by api.js.

import { get, post, patch, del } from '@/services/api';

function unwrap(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

// --- Public reads ---------------------------------------------------------

/**
 * GET /api/app-settings/categories
 * @returns {Promise<Array<{id, name, slug, subCategories: Array}>>}
 */
export async function listCategories() {
  const res = await get('/api/app-settings/categories');
  return unwrap(res) || [];
}

/**
 * GET /api/app-settings/cities
 * @returns {Promise<Array<{id, name, slug}>>}
 */
export async function listCities() {
  const res = await get('/api/app-settings/cities');
  return unwrap(res) || [];
}

// --- Admin: categories ----------------------------------------------------

export async function adminListCategories(params = {}) {
  const res = await get('/api/admin/categories', { params });
  return unwrap(res) || [];
}

export async function adminCreateCategory(data) {
  const res = await post('/api/admin/categories', data);
  return unwrap(res);
}

export async function adminUpdateCategory(id, data) {
  const res = await patch(`/api/admin/categories/${id}`, data);
  return unwrap(res);
}

export async function adminDeleteCategory(id) {
  const res = await del(`/api/admin/categories/${id}`);
  return unwrap(res);
}

// --- Admin: sub-categories ------------------------------------------------

export async function adminCreateSubCategory(data) {
  const res = await post('/api/admin/sub-categories', data);
  return unwrap(res);
}

export async function adminUpdateSubCategory(id, data) {
  const res = await patch(`/api/admin/sub-categories/${id}`, data);
  return unwrap(res);
}

export async function adminDeleteSubCategory(id) {
  const res = await del(`/api/admin/sub-categories/${id}`);
  return unwrap(res);
}

// --- Admin: cities --------------------------------------------------------

export async function adminListCities(params = {}) {
  const res = await get('/api/admin/cities', { params });
  return unwrap(res) || [];
}

export async function adminCreateCity(data) {
  const res = await post('/api/admin/cities', data);
  return unwrap(res);
}

export async function adminUpdateCity(id, data) {
  const res = await patch(`/api/admin/cities/${id}`, data);
  return unwrap(res);
}

export async function adminDeleteCity(id) {
  const res = await del(`/api/admin/cities/${id}`);
  return unwrap(res);
}

// --- Locations hierarchy ---------------------------------------------------

export async function listLocationsPublic() {
  const res = await get('/api/app-settings/locations');
  return unwrap(res) || [];
}

export async function adminListLocations() {
  const res = await get('/api/admin/locations');
  return unwrap(res) || [];
}

export async function adminCreateCountry(data) {
  const res = await post('/api/admin/countries', data);
  return unwrap(res);
}
export async function adminUpdateCountry(id, data) {
  const res = await patch(`/api/admin/countries/${id}`, data);
  return unwrap(res);
}
export async function adminDeleteCountry(id) {
  const res = await del(`/api/admin/countries/${id}`);
  return unwrap(res);
}

export async function adminCreateState(data) {
  const res = await post('/api/admin/states', data);
  return unwrap(res);
}
export async function adminUpdateState(id, data) {
  const res = await patch(`/api/admin/states/${id}`, data);
  return unwrap(res);
}
export async function adminDeleteState(id) {
  const res = await del(`/api/admin/states/${id}`);
  return unwrap(res);
}

export async function adminCreateCityForState(data) {
  const res = await post('/api/admin/locations/cities', data);
  return unwrap(res);
}
export async function adminUpdateCityHierarchical(id, data) {
  const res = await patch(`/api/admin/locations/cities/${id}`, data);
  return unwrap(res);
}
export async function adminDeleteCityHierarchical(id) {
  // Re-uses the legacy /admin/cities DELETE route.
  const res = await del(`/api/admin/cities/${id}`);
  return unwrap(res);
}

// --- Case statuses --------------------------------------------------------

export async function listCaseStatuses() {
  const res = await get('/api/app-settings/case-statuses');
  return unwrap(res) || [];
}

export async function adminListCaseStatuses(params = {}) {
  const res = await get('/api/admin/case-statuses', { params });
  return unwrap(res) || [];
}

export async function adminCreateCaseStatus(data) {
  const res = await post('/api/admin/case-statuses', data);
  return unwrap(res);
}

export async function adminUpdateCaseStatus(id, data) {
  const res = await patch(`/api/admin/case-statuses/${id}`, data);
  return unwrap(res);
}

export async function adminDeleteCaseStatus(id) {
  const res = await del(`/api/admin/case-statuses/${id}`);
  return unwrap(res);
}

// --- Case types -----------------------------------------------------------

export async function listCaseTypes() {
  const res = await get('/api/app-settings/case-types');
  return unwrap(res) || [];
}

export async function adminListCaseTypes(params = {}) {
  const res = await get('/api/admin/case-types', { params });
  return unwrap(res) || [];
}

export async function adminCreateCaseType(data) {
  const res = await post('/api/admin/case-types', data);
  return unwrap(res);
}

export async function adminUpdateCaseType(id, data) {
  const res = await patch(`/api/admin/case-types/${id}`, data);
  return unwrap(res);
}

export async function adminDeleteCaseType(id) {
  const res = await del(`/api/admin/case-types/${id}`);
  return unwrap(res);
}

// --- Cause list types -----------------------------------------------------

export async function listCauseListTypes() {
  const res = await get('/api/app-settings/cause-list-types');
  return unwrap(res) || [];
}

export async function adminListCauseListTypes(params = {}) {
  const res = await get('/api/admin/cause-list-types', { params });
  return unwrap(res) || [];
}

export async function adminCreateCauseListType(data) {
  const res = await post('/api/admin/cause-list-types', data);
  return unwrap(res);
}

export async function adminUpdateCauseListType(id, data) {
  const res = await patch(`/api/admin/cause-list-types/${id}`, data);
  return unwrap(res);
}

export async function adminDeleteCauseListType(id) {
  const res = await del(`/api/admin/cause-list-types/${id}`);
  return unwrap(res);
}

export default {
  listCategories,
  listCities,
  adminListCategories,
  adminCreateCategory,
  adminUpdateCategory,
  adminDeleteCategory,
  adminCreateSubCategory,
  adminUpdateSubCategory,
  adminDeleteSubCategory,
  adminListCities,
  adminCreateCity,
  adminUpdateCity,
  adminDeleteCity,
  listCaseStatuses,
  adminListCaseStatuses,
  adminCreateCaseStatus,
  adminUpdateCaseStatus,
  adminDeleteCaseStatus,
  listCaseTypes,
  adminListCaseTypes,
  adminCreateCaseType,
  adminUpdateCaseType,
  adminDeleteCaseType,
  listCauseListTypes,
  adminListCauseListTypes,
  adminCreateCauseListType,
  adminUpdateCauseListType,
  adminDeleteCauseListType,
};
