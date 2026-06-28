const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const { logAudit } = require('../utils/auditLogger');
const svc = require('../services/appSettingsService');
const storageService = require('../services/storageService');

// --- Public read endpoints ------------------------------------------------

const publicListCategories = asyncHandler(async (req, res) => {
  const categories = await svc.listCategoriesPublic();
  return successResponse(res, 200, 'Categories fetched', categories);
});

const publicListCities = asyncHandler(async (req, res) => {
  const cities = await svc.listCitiesPublic();
  return successResponse(res, 200, 'Cities fetched', cities);
});

// GET /api/app-settings/storage
// Public-safe storage config — driver name + base URL only, never the
// access key or secret. The web + mobile clients fetch this once at
// startup so resolveFileUrl() can prefix bare S3 keys with the right
// CDN host. Cached on the client; no auth required.
const publicGetStorage = asyncHandler(async (req, res) => {
  const cfg = await storageService.getPublicConfig();
  return successResponse(res, 200, 'Storage config', cfg);
});

// GET /api/app-settings/mobile-version
// Latest + minimum supported app versions per platform, plus the
// store URL. The mobile app fetches this on launch — if the
// installed version is below `minimum`, an update is forced; below
// `latest`, an optional update prompt is shown. Configured via env
// vars so a new release can be cut without a DB migration:
//
//   MOBILE_IOS_LATEST_VERSION=0.2.0
//   MOBILE_IOS_MIN_VERSION=0.1.0
//   MOBILE_IOS_STORE_URL=https://apps.apple.com/app/id…
//   MOBILE_ANDROID_LATEST_VERSION=0.2.0
//   MOBILE_ANDROID_MIN_VERSION=0.1.0
//   MOBILE_ANDROID_STORE_URL=https://play.google.com/store/apps/details?id=com.profirmo.app
const publicGetMobileVersion = asyncHandler(async (req, res) => {
  const FALLBACK_IOS_STORE =
    'https://apps.apple.com/app/profirmo/id0000000000';
  const FALLBACK_ANDROID_STORE =
    'https://play.google.com/store/apps/details?id=com.profirmo.app';
  return successResponse(res, 200, 'Mobile version config', {
    ios: {
      latest: process.env.MOBILE_IOS_LATEST_VERSION || null,
      minimum: process.env.MOBILE_IOS_MIN_VERSION || null,
      storeUrl: process.env.MOBILE_IOS_STORE_URL || FALLBACK_IOS_STORE,
    },
    android: {
      latest: process.env.MOBILE_ANDROID_LATEST_VERSION || null,
      minimum: process.env.MOBILE_ANDROID_MIN_VERSION || null,
      storeUrl: process.env.MOBILE_ANDROID_STORE_URL || FALLBACK_ANDROID_STORE,
    },
  });
});

// GET /api/app-settings/cities/by-slug/:slug
// Resolves a public city slug (e.g. "mumbai", "new-delhi") to the
// canonical city row + state + country. Powers the SEO landing pages
// at /professionals/city/[slug].
const publicGetCityBySlug = asyncHandler(async (req, res) => {
  const slug = String((req.params && req.params.slug) || '');
  const city = await svc.findCityByPublicSlug(slug);
  if (!city) {
    throw { statusCode: 404, message: `No city found for slug "${slug}".` };
  }
  return successResponse(res, 200, 'City', city);
});

// --- Admin: categories ----------------------------------------------------

const adminListCategories = asyncHandler(async (req, res) => {
  const rows = await svc.listCategoriesAdmin({ search: req.query.search });
  return successResponse(res, 200, 'Categories fetched', rows);
});

const adminCreateCategory = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const cat = await svc.createCategory(req.body || {});
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.category_created',
    entity: 'category',
    entityId: cat.id,
    status: 'success',
    metadata: { name: cat.name },
  });
  return successResponse(res, 201, 'Category created', cat);
});

const adminUpdateCategory = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const cat = await svc.updateCategory(req.params.id, req.body || {});
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.category_updated',
    entity: 'category',
    entityId: req.params.id,
    status: 'success',
    metadata: { fields: Object.keys(req.body || {}) },
  });
  return successResponse(res, 200, 'Category updated', cat);
});

const adminDeleteCategory = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const result = await svc.deleteCategory(req.params.id);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.category_deleted',
    entity: 'category',
    entityId: req.params.id,
    status: 'success',
    metadata: {},
  });
  return successResponse(res, 200, 'Category deleted', result);
});

// --- Admin: sub-categories ------------------------------------------------

const adminCreateSubCategory = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const sub = await svc.createSubCategory(req.body || {});
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.sub_category_created',
    entity: 'sub_category',
    entityId: sub.id,
    status: 'success',
    metadata: { name: sub.name, categoryId: sub.categoryId },
  });
  return successResponse(res, 201, 'Sub-category created', sub);
});

const adminUpdateSubCategory = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const sub = await svc.updateSubCategory(req.params.id, req.body || {});
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.sub_category_updated',
    entity: 'sub_category',
    entityId: req.params.id,
    status: 'success',
    metadata: { fields: Object.keys(req.body || {}) },
  });
  return successResponse(res, 200, 'Sub-category updated', sub);
});

const adminDeleteSubCategory = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const result = await svc.deleteSubCategory(req.params.id);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.sub_category_deleted',
    entity: 'sub_category',
    entityId: req.params.id,
    status: 'success',
    metadata: {},
  });
  return successResponse(res, 200, 'Sub-category deleted', result);
});

// --- Admin: cities --------------------------------------------------------

const adminListCities = asyncHandler(async (req, res) => {
  const rows = await svc.listCitiesAdmin({ search: req.query.search });
  return successResponse(res, 200, 'Cities fetched', rows);
});

const adminCreateCity = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const city = await svc.createCity(req.body || {});
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.city_created',
    entity: 'city',
    entityId: city.id,
    status: 'success',
    metadata: { name: city.name },
  });
  return successResponse(res, 201, 'City created', city);
});

const adminUpdateCity = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const city = await svc.updateCity(req.params.id, req.body || {});
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.city_updated',
    entity: 'city',
    entityId: req.params.id,
    status: 'success',
    metadata: { fields: Object.keys(req.body || {}) },
  });
  return successResponse(res, 200, 'City updated', city);
});

const adminDeleteCity = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const result = await svc.deleteCity(req.params.id);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.city_deleted',
    entity: 'city',
    entityId: req.params.id,
    status: 'success',
    metadata: {},
  });
  return successResponse(res, 200, 'City deleted', result);
});

// --- Public + admin: locations hierarchy ---------------------------------

const publicListLocations = asyncHandler(async (req, res) => {
  const data = await svc.listLocationsPublic();
  return successResponse(res, 200, 'Locations fetched', data);
});

const adminListLocations = asyncHandler(async (req, res) => {
  const data = await svc.listLocationsAdmin();
  return successResponse(res, 200, 'Locations fetched', data);
});

const adminCreateCountry = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const row = await svc.createCountry(req.body || {});
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.country_created',
    entity: 'country',
    entityId: row.id,
    status: 'success',
    metadata: { name: row.name },
  });
  return successResponse(res, 201, 'Country created', row);
});

const adminUpdateCountry = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const row = await svc.updateCountry(req.params.id, req.body || {});
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.country_updated',
    entity: 'country',
    entityId: req.params.id,
    status: 'success',
    metadata: { fields: Object.keys(req.body || {}) },
  });
  return successResponse(res, 200, 'Country updated', row);
});

const adminDeleteCountry = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const result = await svc.deleteCountry(req.params.id);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.country_deleted',
    entity: 'country',
    entityId: req.params.id,
    status: 'success',
    metadata: {},
  });
  return successResponse(res, 200, 'Country deleted', result);
});

const adminCreateState = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const row = await svc.createState(req.body || {});
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.state_created',
    entity: 'state',
    entityId: row.id,
    status: 'success',
    metadata: { name: row.name, countryId: row.countryId },
  });
  return successResponse(res, 201, 'State created', row);
});

const adminUpdateState = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const row = await svc.updateState(req.params.id, req.body || {});
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.state_updated',
    entity: 'state',
    entityId: req.params.id,
    status: 'success',
    metadata: { fields: Object.keys(req.body || {}) },
  });
  return successResponse(res, 200, 'State updated', row);
});

const adminDeleteState = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const result = await svc.deleteState(req.params.id);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.state_deleted',
    entity: 'state',
    entityId: req.params.id,
    status: 'success',
    metadata: {},
  });
  return successResponse(res, 200, 'State deleted', result);
});

const adminCreateCityForState = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const row = await svc.createCityForState(req.body || {});
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.city_created',
    entity: 'city',
    entityId: row.id,
    status: 'success',
    metadata: { name: row.name, stateId: row.stateId },
  });
  return successResponse(res, 201, 'City created', row);
});

const adminUpdateCityHierarchical = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const row = await svc.updateCityHierarchical(req.params.id, req.body || {});
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.city_updated',
    entity: 'city',
    entityId: req.params.id,
    status: 'success',
    metadata: { fields: Object.keys(req.body || {}) },
  });
  return successResponse(res, 200, 'City updated', row);
});

// --- Case statuses --------------------------------------------------------

const publicListCaseStatuses = asyncHandler(async (req, res) => {
  const rows = await svc.listCaseStatusesPublic();
  return successResponse(res, 200, 'Case statuses fetched', rows);
});

const adminListCaseStatuses = asyncHandler(async (req, res) => {
  const rows = await svc.listCaseStatusesAdmin({ search: req.query.search });
  return successResponse(res, 200, 'Case statuses fetched', rows);
});

const adminCreateCaseStatus = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const row = await svc.createCaseStatus(req.body || {});
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.case_status_created',
    entity: 'case_status',
    entityId: row.id,
    status: 'success',
    metadata: { value: row.value },
  });
  return successResponse(res, 201, 'Case status created', row);
});

const adminUpdateCaseStatus = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const row = await svc.updateCaseStatus(req.params.id, req.body || {});
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.case_status_updated',
    entity: 'case_status',
    entityId: req.params.id,
    status: 'success',
    metadata: { fields: Object.keys(req.body || {}) },
  });
  return successResponse(res, 200, 'Case status updated', row);
});

const adminDeleteCaseStatus = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const result = await svc.deleteCaseStatus(req.params.id);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.case_status_deleted',
    entity: 'case_status',
    entityId: req.params.id,
    status: 'success',
    metadata: {},
  });
  return successResponse(res, 200, 'Case status deleted', result);
});

// --- Case types -----------------------------------------------------------

const publicListCaseTypes = asyncHandler(async (req, res) => {
  const rows = await svc.listCaseTypesPublic();
  return successResponse(res, 200, 'Case types fetched', rows);
});

const adminListCaseTypes = asyncHandler(async (req, res) => {
  const rows = await svc.listCaseTypesAdmin({ search: req.query.search });
  return successResponse(res, 200, 'Case types fetched', rows);
});

const adminCreateCaseType = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const row = await svc.createCaseType(req.body || {});
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.case_type_created',
    entity: 'case_type',
    entityId: row.id,
    status: 'success',
    metadata: { value: row.value },
  });
  return successResponse(res, 201, 'Case type created', row);
});

const adminUpdateCaseType = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const row = await svc.updateCaseType(req.params.id, req.body || {});
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.case_type_updated',
    entity: 'case_type',
    entityId: req.params.id,
    status: 'success',
    metadata: { fields: Object.keys(req.body || {}) },
  });
  return successResponse(res, 200, 'Case type updated', row);
});

const adminDeleteCaseType = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const result = await svc.deleteCaseType(req.params.id);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.case_type_deleted',
    entity: 'case_type',
    entityId: req.params.id,
    status: 'success',
    metadata: {},
  });
  return successResponse(res, 200, 'Case type deleted', result);
});

// --- Cause list types -----------------------------------------------------

const publicListCauseListTypes = asyncHandler(async (req, res) => {
  const rows = await svc.listCauseListTypesPublic();
  return successResponse(res, 200, 'Cause list types fetched', rows);
});

const adminListCauseListTypes = asyncHandler(async (req, res) => {
  const rows = await svc.listCauseListTypesAdmin({ search: req.query.search });
  return successResponse(res, 200, 'Cause list types fetched', rows);
});

const adminCreateCauseListType = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const row = await svc.createCauseListType(req.body || {});
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.cause_list_type_created',
    entity: 'cause_list_type',
    entityId: row.id,
    status: 'success',
    metadata: { value: row.value },
  });
  return successResponse(res, 201, 'Cause list type created', row);
});

const adminUpdateCauseListType = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const row = await svc.updateCauseListType(req.params.id, req.body || {});
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.cause_list_type_updated',
    entity: 'cause_list_type',
    entityId: req.params.id,
    status: 'success',
    metadata: { fields: Object.keys(req.body || {}) },
  });
  return successResponse(res, 200, 'Cause list type updated', row);
});

const adminDeleteCauseListType = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const result = await svc.deleteCauseListType(req.params.id);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.cause_list_type_deleted',
    entity: 'cause_list_type',
    entityId: req.params.id,
    status: 'success',
    metadata: {},
  });
  return successResponse(res, 200, 'Cause list type deleted', result);
});

module.exports = {
  publicListCategories,
  publicListCities,
  publicGetCityBySlug,
  publicGetStorage,
  publicGetMobileVersion,
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
  // Locations hierarchy
  publicListLocations,
  adminListLocations,
  adminCreateCountry,
  adminUpdateCountry,
  adminDeleteCountry,
  adminCreateState,
  adminUpdateState,
  adminDeleteState,
  adminCreateCityForState,
  adminUpdateCityHierarchical,
  // Case statuses
  publicListCaseStatuses,
  adminListCaseStatuses,
  adminCreateCaseStatus,
  adminUpdateCaseStatus,
  adminDeleteCaseStatus,
  // Case types
  publicListCaseTypes,
  adminListCaseTypes,
  adminCreateCaseType,
  adminUpdateCaseType,
  adminDeleteCaseType,
  // Cause list types
  publicListCauseListTypes,
  adminListCauseListTypes,
  adminCreateCauseListType,
  adminUpdateCauseListType,
  adminDeleteCauseListType,
};
