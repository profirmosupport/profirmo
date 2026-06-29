// emailTemplateController — admin CRUD over the email_templates table.
// All endpoints require platform_admin (gated by the router middleware).

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const emailTemplateService = require('../services/emailTemplateService');
const emailService = require('../services/emailService');
const { logAudit } = require('../utils/auditLogger');

// GET /api/admin/email-templates
const list = asyncHandler(async (req, res) => {
  const items = await emailTemplateService.listForAdmin();
  return successResponse(res, 200, 'Email templates', { items });
});

// GET /api/admin/email-templates/:key
const get = asyncHandler(async (req, res) => {
  const item = await emailTemplateService.getForAdmin(req.params.key);
  return successResponse(res, 200, 'Email template', { item });
});

// PUT /api/admin/email-templates/:key
//   body: { subject, htmlBody, textBody, enabled? }
const update = asyncHandler(async (req, res) => {
  const adminId = req.user && req.user.id;
  const row = await emailTemplateService.saveForAdmin(
    req.params.key,
    req.body || {},
    adminId
  );
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.email_template_updated',
    entity: 'email_template',
    entityId: req.params.key,
    status: 'success',
    metadata: { subject: row.subject, enabled: row.enabled },
  });
  return successResponse(res, 200, 'Template saved', { item: row });
});

// DELETE /api/admin/email-templates/:key — drop the custom row; the
// renderer falls back to the hardcoded default.
const reset = asyncHandler(async (req, res) => {
  const adminId = req.user && req.user.id;
  await emailTemplateService.resetForAdmin(req.params.key);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.email_template_reset',
    entity: 'email_template',
    entityId: req.params.key,
    status: 'success',
  });
  return successResponse(res, 200, 'Template reset to default', {
    key: req.params.key,
  });
});

// POST /api/admin/email-templates/:key/preview
//   body: { vars }
// Returns the rendered subject + html + text WITHOUT sending. Used by
// the admin editor's live preview pane.
const preview = asyncHandler(async (req, res) => {
  const vars = (req.body && req.body.vars) || {};
  const rendered = await emailTemplateService.renderForSend(
    req.params.key,
    vars
  );
  return successResponse(res, 200, 'Preview rendered', rendered);
});

// POST /api/admin/email-templates/:key/test
//   body: { to, vars }
// Renders the template (DB-aware) and sends it via the live SMTP
// transport. Recipient defaults to the authenticated admin.
const test = asyncHandler(async (req, res) => {
  const adminId = req.user && req.user.id;
  const to = (req.body && req.body.to) || (req.user && req.user.email);
  if (!to) {
    throw { statusCode: 422, message: 'Recipient email is required.' };
  }
  const vars = (req.body && req.body.vars) || {};
  const rendered = await emailTemplateService.renderForSend(
    req.params.key,
    vars
  );
  try {
    const info = await emailService.sendTestEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    await logAudit({
      req,
      userId: adminId,
      action: 'admin.email_template_test_ok',
      entity: 'email_template',
      entityId: req.params.key,
      status: 'success',
      metadata: { to, messageId: info.messageId },
    });
    return successResponse(res, 200, 'Test email sent', {
      to,
      messageId: info.messageId,
      accepted: info.accepted,
      response: info.response,
    });
  } catch (err) {
    await logAudit({
      req,
      userId: adminId,
      action: 'admin.email_template_test_failed',
      entity: 'email_template',
      entityId: req.params.key,
      status: 'failure',
      metadata: { to, message: err && err.message },
    });
    throw err;
  }
});

module.exports = { list, get, update, reset, preview, test };
