// adminSettingsController — admin-only CRUD over the AdminSetting key/value
// store. The setting registry lives in adminSettingsService; this controller
// is a thin HTTP layer with audit logging.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const adminSettingsService = require('../services/adminSettingsService');
const storageService = require('../services/storageService');
const emailService = require('../services/emailService');
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

// POST /api/admin/settings/email/test  body: { to }
// Sends a one-off "Profirmo SMTP test" email using the live admin
// settings — runs even when env.emailTransport is still 'dev', so the
// admin can validate credentials before flipping to production sends.
const testEmail = asyncHandler(async (req, res) => {
  const adminId = req.user && req.user.id;
  const to = (req.body && req.body.to) || (req.user && req.user.email);
  if (!to) {
    throw {
      statusCode: 422,
      message: 'Recipient email is required.',
    };
  }
  try {
    const info = await emailService.sendTestEmail({
      to,
      subject: 'Profirmo SMTP test',
      html:
        '<p>This is a test message from the Profirmo admin SMTP panel.</p>' +
        '<p>If you got this, outgoing mail is wired up correctly.</p>',
      text:
        'This is a test message from the Profirmo admin SMTP panel.\n' +
        'If you got this, outgoing mail is wired up correctly.',
    });
    await logAudit({
      req,
      userId: adminId,
      action: 'admin.email_test_ok',
      entity: 'smtp',
      entityId: to,
      status: 'success',
      metadata: { messageId: info.messageId, from: info.from },
    });
    return successResponse(res, 200, 'Test email accepted by the SMTP server', {
      to,
      messageId: info.messageId,
      accepted: info.accepted,
      response: info.response,
      from: info.from,
    });
  } catch (err) {
    await logAudit({
      req,
      userId: adminId,
      action: 'admin.email_test_failed',
      entity: 'smtp',
      entityId: to,
      status: 'failure',
      metadata: { message: err && err.message },
    });
    throw err;
  }
});

module.exports = { list, update, testStorage, testEmail };
