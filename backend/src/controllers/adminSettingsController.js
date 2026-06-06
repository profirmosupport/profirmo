// adminSettingsController — admin-only CRUD over the AdminSetting key/value
// store. The setting registry lives in adminSettingsService; this controller
// is a thin HTTP layer with audit logging.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const adminSettingsService = require('../services/adminSettingsService');
const storageService = require('../services/storageService');
const { logAudit } = require('../utils/auditLogger');

// GET /api/admin/settings
const list = asyncHandler(async (req, res) => {
  const items = await adminSettingsService.listAll();
  return successResponse(res, 200, 'Admin settings', { items });
});

// PATCH /api/admin/settings/:key  body: { value }
const update = asyncHandler(async (req, res) => {
  const adminId = req.user && req.user.id;
  const newValue = await adminSettingsService.set(
    req.params.key,
    req.body && req.body.value,
    adminId
  );
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.setting_updated',
    entity: 'admin_setting',
    entityId: req.params.key,
    status: 'success',
    metadata: { value: newValue },
  });
  return successResponse(res, 200, 'Setting updated', {
    key: req.params.key,
    value: newValue,
  });
});

// POST /api/admin/settings/storage/test
// Uploads a tiny file to temp/ and deletes it. Useful one-click sanity
// check on a freshly-configured S3 bucket. Admin-only.
const testStorage = asyncHandler(async (req, res) => {
  const adminId = req.user && req.user.id;
  try {
    const result = await storageService.testConnection();
    await logAudit({
      req,
      userId: adminId,
      action: 'admin.storage_test_ok',
      entity: 'storage',
      entityId: result.bucket,
      status: 'success',
      metadata: result,
    });
    return successResponse(res, 200, 'S3 connection succeeded', result);
  } catch (err) {
    await logAudit({
      req,
      userId: adminId,
      action: 'admin.storage_test_failed',
      entity: 'storage',
      status: 'failure',
      metadata: { message: err && err.message },
    });
    // Re-throw so the central error handler turns it into the right
    // HTTP response (4xx for misconfig, 5xx for network errors).
    throw err;
  }
});

module.exports = { list, update, testStorage };
