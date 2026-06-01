// appSettingsService — public reads against the backend's
// /api/app-settings/* endpoints. The signup wizard uses these to drive
// the cascading Country → State → City pickers, the multi-select
// practice-cities field, and the sub-category chips.

import { apiGet, unwrap } from './api';

/**
 * GET /api/app-settings/locations
 * Returns the full hierarchy:
 *   [ { id, name, code, states: [ { id, name, cities: [ ... ] } ] } ]
 */
export async function listLocations() {
  const res = await apiGet('/api/app-settings/locations');
  const data = unwrap(res);
  return Array.isArray(data) ? data : [];
}

/**
 * GET /api/app-settings/categories
 * Returns the admin-managed taxonomy:
 *   [ { id, name, slug, subCategories: [ { id, name, slug } ] } ]
 */
export async function listCategories() {
  const res = await apiGet('/api/app-settings/categories');
  const data = unwrap(res);
  return Array.isArray(data) ? data : [];
}
