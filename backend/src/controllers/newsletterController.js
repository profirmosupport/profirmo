// newsletterController — public subscribe/complete + admin CRUD over
// the newsletter_subscribers table.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const newsletterService = require('../services/newsletterService');
const { logAudit } = require('../utils/auditLogger');

// POST /api/newsletter/subscribe — body: { email }
const subscribe = asyncHandler(async (req, res) => {
  const { email, source } = req.body || {};
  const result = await newsletterService.subscribe({
    email,
    source,
    ipAddress: req.ip,
    userAgent: req.headers && req.headers['user-agent'],
  });
  return successResponse(
    res,
    result.isNew ? 201 : 200,
    result.isNew ? 'Subscribed' : 'Already subscribed',
    result
  );
});

// PATCH /api/newsletter/complete — body: { email, fullName, phone, city, interests }
// Public on purpose — the visitor doesn't have an auth token yet.
// Identified by email (must match a row created by /subscribe).
const complete = asyncHandler(async (req, res) => {
  const row = await newsletterService.completeProfile(req.body || {});
  return successResponse(res, 200, 'Profile updated', row);
});

// --- Admin ----------------------------------------------------------------

// GET /api/admin/newsletter?page=&limit=&search=&status=
const adminList = asyncHandler(async (req, res) => {
  const result = await newsletterService.listSubscribers({
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search,
    status: req.query.status,
  });
  return successResponse(res, 200, 'Subscribers', result);
});

// PATCH /api/admin/newsletter/:id  body: { status }
const adminSetStatus = asyncHandler(async (req, res) => {
  const adminId = req.user && req.user.id;
  const next = req.body && req.body.status;
  const row = await newsletterService.setStatus(req.params.id, next);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.newsletter_status_changed',
    entity: 'newsletter_subscriber',
    entityId: row.id,
    status: 'success',
    metadata: { status: next },
  });
  return successResponse(res, 200, 'Subscriber updated', row);
});

// DELETE /api/admin/newsletter/:id
const adminRemove = asyncHandler(async (req, res) => {
  const adminId = req.user && req.user.id;
  const result = await newsletterService.removeSubscriber(req.params.id);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.newsletter_deleted',
    entity: 'newsletter_subscriber',
    entityId: result.id,
    status: 'success',
    metadata: {},
  });
  return successResponse(res, 200, 'Subscriber deleted', result);
});

module.exports = {
  subscribe,
  complete,
  adminList,
  adminSetStatus,
  adminRemove,
};
