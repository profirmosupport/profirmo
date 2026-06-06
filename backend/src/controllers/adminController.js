const adminService = require('../services/adminService');
const professionalApprovalService = require('../services/professionalApprovalService');
const firmApprovalService = require('../services/firmApprovalService');
const reviewService = require('../services/reviewService');
const asyncHandler = require('../utils/asyncHandler');
const {
  successResponse,
  paginatedResponse,
} = require('../utils/responseHandler');
const { logAudit } = require('../utils/auditLogger');

// GET /api/admin/stats
const getStats = asyncHandler(async (req, res) => {
  const stats = await adminService.getStats();
  return successResponse(res, 200, 'Platform statistics fetched', stats);
});

// GET /api/admin/overview
// A single comprehensive admin dashboard snapshot.
const getOverview = asyncHandler(async (req, res) => {
  const overview = await adminService.getOverview();
  return successResponse(res, 200, 'Admin overview fetched', overview);
});

// GET /api/admin/users?page=&limit=&role=&status=&search=
const listUsers = asyncHandler(async (req, res) => {
  const { rows, page, limit, total } = await adminService.listUsers({
    page: req.query.page,
    limit: req.query.limit,
    role: req.query.role,
    status: req.query.status,
    search: req.query.search,
  });
  return paginatedResponse(res, 'Users fetched', rows, {
    page,
    limit,
    total,
  });
});

// PATCH /api/admin/users/:id/status  body: { status }
const updateUserStatus = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const targetUserId = req.params.id;
  const { user, previousStatus } = await adminService.updateUserStatus({
    targetUserId,
    status: req.body && req.body.status,
    actingUserId: adminId,
  });
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.user.status_changed',
    entity: 'user',
    entityId: targetUserId,
    status: 'success',
    metadata: {
      targetUserId,
      oldStatus: previousStatus,
      newStatus: user.status,
    },
  });
  return successResponse(res, 200, 'User status updated', { user });
});

// GET /api/admin/professionals/pending
const getPendingProfessionals = asyncHandler(async (req, res) => {
  const pending = await adminService.getPendingProfessionals();
  return successResponse(res, 200, 'Pending professionals fetched', pending);
});

// PATCH /api/admin/professionals/:id/approve
const approveProfessional = asyncHandler(async (req, res) => {
  const professional = await adminService.approveProfessional(req.params.id);
  if (!professional) {
    throw {
      statusCode: 404,
      message: `Professional not found: ${req.params.id}`,
    };
  }
  return successResponse(res, 200, 'Professional approved', professional);
});

// GET /api/admin/firms
const listFirms = asyncHandler(async (req, res) => {
  const firms = await adminService.listFirms();
  return successResponse(res, 200, 'Firms fetched', firms);
});

// GET /api/admin/bookings
const listBookings = asyncHandler(async (req, res) => {
  const bookings = await adminService.listBookings();
  return successResponse(res, 200, 'Bookings fetched', bookings);
});

// GET /api/admin/audit-logs?page=&limit=&action=&status=&userId=
const listAuditLogs = asyncHandler(async (req, res) => {
  const { rows, page, limit, total } = await adminService.listAuditLogs({
    page: req.query.page,
    limit: req.query.limit,
    action: req.query.action,
    status: req.query.status,
    userId: req.query.userId,
  });
  return paginatedResponse(res, 'Audit logs fetched', rows, {
    page,
    limit,
    total,
  });
});

// --- Phase 7: professional approval workflow -------------------------------

// GET /api/admin/professionals/pending?page=&limit=
// Lists applications with status PENDING_APPROVAL or INFO_REQUESTED.
const listPendingApprovals = asyncHandler(async (req, res) => {
  const { rows, page, limit, total } =
    await professionalApprovalService.listPending({
      page: req.query.page,
      limit: req.query.limit,
    });
  return paginatedResponse(res, 'Pending professional applications fetched', rows, {
    page,
    limit,
    total,
  });
});

// GET /api/admin/professionals/:approvalId
// Full review payload: approval + user + address + professional detail +
// the type-specific (lawyer / tax-consultant) detail.
const getProfessionalApproval = asyncHandler(async (req, res) => {
  const payload = await professionalApprovalService.getReviewPayload(
    req.params.approvalId
  );
  return successResponse(res, 200, 'Application review fetched', payload);
});

// POST /api/admin/professionals/:approvalId/approve
const approveProfessionalApplication = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const approval = await professionalApprovalService.approve(
    req.params.approvalId,
    adminId
  );
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.professional_approved',
    entity: 'professional_approval',
    entityId: approval.id,
    status: 'success',
    metadata: { professionalUserId: approval.userId },
  });
  return successResponse(res, 200, 'Professional application approved', {
    approval,
  });
});

// POST /api/admin/professionals/:approvalId/reject  body: { reason }
const rejectProfessionalApplication = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const approval = await professionalApprovalService.reject(
    req.params.approvalId,
    adminId,
    req.body && req.body.reason
  );
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.professional_rejected',
    entity: 'professional_approval',
    entityId: approval.id,
    status: 'success',
    metadata: { professionalUserId: approval.userId },
  });
  return successResponse(res, 200, 'Professional application rejected', {
    approval,
  });
});

// POST /api/admin/professionals/:approvalId/request-info  body: { message }
const requestProfessionalInfo = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const approval = await professionalApprovalService.requestInfo(
    req.params.approvalId,
    adminId,
    req.body && req.body.message
  );
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.professional_info_requested',
    entity: 'professional_approval',
    entityId: approval.id,
    status: 'success',
    metadata: { professionalUserId: approval.userId },
  });
  return successResponse(res, 200, 'Additional information requested', {
    approval,
  });
});

// --- Phase 8: firm approval workflow --------------------------------------

// GET /api/admin/firms/pending?page=&limit=
// Lists firm applications with status PENDING_APPROVAL or
// MODIFICATIONS_REQUESTED, newest first.
const listPendingFirms = asyncHandler(async (req, res) => {
  const { rows, page, limit, total } = await firmApprovalService.listPending({
    page: req.query.page,
    limit: req.query.limit,
  });
  return paginatedResponse(res, 'Pending firm applications fetched', rows, {
    page,
    limit,
    total,
  });
});

// GET /api/admin/firms/:approvalId
// Full review payload: the FirmApproval + LawFirm + owner user.
const getFirmApproval = asyncHandler(async (req, res) => {
  const payload = await firmApprovalService.getReviewPayload(
    req.params.approvalId
  );
  return successResponse(res, 200, 'Firm application review fetched', payload);
});

// POST /api/admin/firms/:approvalId/approve
const approveFirmApplication = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const approval = await firmApprovalService.approve(
    req.params.approvalId,
    adminId
  );
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.firm_approved',
    entity: 'firm_approval',
    entityId: approval.id,
    status: 'success',
    metadata: { firmId: approval.firmId },
  });
  return successResponse(res, 200, 'Law firm approved', { approval });
});

// POST /api/admin/firms/:approvalId/reject  body: { reason }
const rejectFirmApplication = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const approval = await firmApprovalService.reject(
    req.params.approvalId,
    adminId,
    req.body && req.body.reason
  );
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.firm_rejected',
    entity: 'firm_approval',
    entityId: approval.id,
    status: 'success',
    metadata: { firmId: approval.firmId },
  });
  return successResponse(res, 200, 'Law firm rejected', { approval });
});

// POST /api/admin/firms/:approvalId/request-modifications  body: { message }
const requestFirmModifications = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const approval = await firmApprovalService.requestModifications(
    req.params.approvalId,
    adminId,
    req.body && req.body.message
  );
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.firm_modifications_requested',
    entity: 'firm_approval',
    entityId: approval.id,
    status: 'success',
    metadata: { firmId: approval.firmId },
  });
  return successResponse(res, 200, 'Modifications requested for the firm', {
    approval,
  });
});

// --- Admin user CRUD ------------------------------------------------------

// GET /api/admin/users/:id
const getUser = asyncHandler(async (req, res) => {
  const user = await adminService.getUserById(req.params.id);
  return successResponse(res, 200, 'User fetched', user);
});

// GET /api/admin/users/:id/transactions
// Returns booking payments + subscription payments + payout requests for
// the user, decorated with counterparty / plan info and summary totals.
const getUserTransactions = asyncHandler(async (req, res) => {
  const result = await adminService.getUserTransactions(req.params.id);
  return successResponse(res, 200, 'User transactions', result);
});

// POST /api/admin/users
const createUser = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const result = await adminService.createUser({
    data: req.body,
    actingUserId: adminId,
  });
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.user_created',
    entity: 'user',
    entityId: result.user.id,
    status: 'success',
    metadata: { role: result.user.role, email: result.user.email },
  });
  return successResponse(res, 201, 'User created', result.user);
});

// PATCH /api/admin/users/:id
const updateUser = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const result = await adminService.updateUser({
    targetUserId: req.params.id,
    changes: req.body,
    actingUserId: adminId,
  });
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.user_updated',
    entity: 'user',
    entityId: req.params.id,
    status: 'success',
    metadata: { fields: Object.keys(req.body || {}) },
  });
  return successResponse(res, 200, 'User updated', result.user);
});

// DELETE /api/admin/users/:id
const deleteUser = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const result = await adminService.deleteUser({
    targetUserId: req.params.id,
    actingUserId: adminId,
  });
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.user_deleted',
    entity: 'user',
    entityId: req.params.id,
    status: 'success',
    metadata: {},
  });
  return successResponse(res, 200, 'User deleted', result);
});

// --- Admin firm (law_firms) CRUD ------------------------------------------

// GET /api/admin/law-firms?page=&limit=&search=&status=
const listLawFirms = asyncHandler(async (req, res) => {
  const { items, ...meta } = await adminService.listLawFirms({
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search,
    status: req.query.status,
  });
  return paginatedResponse(res, 'Firms fetched', items, meta);
});

// GET /api/admin/law-firms/:id
const getLawFirmDetail = asyncHandler(async (req, res) => {
  const firm = await adminService.getLawFirmById(req.params.id);
  return successResponse(res, 200, 'Firm fetched', firm);
});

// POST /api/admin/law-firms
const createLawFirm = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const result = await adminService.createLawFirm(req.body, adminId);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.firm_created',
    entity: 'law_firm',
    entityId: result.firm.id,
    status: 'success',
    metadata: { firmName: result.firm.firmName },
  });
  return successResponse(res, 201, 'Firm created', result.firm);
});

// PATCH /api/admin/law-firms/:id
const updateLawFirm = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const firm = await adminService.updateLawFirm(req.params.id, req.body);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.firm_updated',
    entity: 'law_firm',
    entityId: req.params.id,
    status: 'success',
    metadata: { fields: Object.keys(req.body || {}) },
  });
  return successResponse(res, 200, 'Firm updated', firm);
});

// PATCH /api/admin/professionals/:id/featured
// Body: { featured: boolean }
// Flips the home-page directory spotlight flag. Audit-logged so we can
// trace who curated the list.
const setProfessionalFeatured = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const result = await adminService.setProfessionalFeatured(
    req.params.id,
    req.body && req.body.featured
  );
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.professional_featured_changed',
    entity: 'professional_detail',
    entityId: result.id,
    status: 'success',
    metadata: { featured: result.featured },
  });
  return successResponse(res, 200, 'Featured flag updated', result);
});

// DELETE /api/admin/law-firms/:id
const deleteLawFirm = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const result = await adminService.deleteLawFirm(req.params.id);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.firm_deleted',
    entity: 'law_firm',
    entityId: req.params.id,
    status: 'success',
    metadata: {},
  });
  return successResponse(res, 200, 'Firm deleted', result);
});

// --- Reviews & review appeals ---------------------------------------------

// GET /api/admin/reviews?page=&limit=&status=&minRating=&professionalId=&kind=
const listReviews = asyncHandler(async (req, res) => {
  const { items, ...meta } = await reviewService.listAll({
    filters: {
      status: req.query.status,
      minRating: req.query.minRating,
      professionalId: req.query.professionalId,
      kind: req.query.kind,
    },
    page: req.query.page,
    limit: req.query.limit,
  });
  return paginatedResponse(res, 'Reviews fetched', items, meta);
});

// PATCH /api/admin/reviews/:id
const updateReview = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const review = await reviewService.adminUpdate(req.params.id, {
    rating: req.body.rating,
    comment: req.body.comment,
  });
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.review_updated',
    entity: 'review',
    entityId: review.id,
    status: 'success',
    metadata: { professionalId: review.professionalId },
  });
  return successResponse(res, 200, 'Review updated', review);
});

// DELETE /api/admin/reviews/:id
const deleteReview = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const result = await reviewService.adminDelete(req.params.id);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.review_deleted',
    entity: 'review',
    entityId: req.params.id,
    status: 'success',
    metadata: {},
  });
  return successResponse(res, 200, 'Review deleted', result);
});

// GET /api/admin/review-appeals?page=&limit=&status=
const listReviewAppeals = asyncHandler(async (req, res) => {
  const { items, ...meta } = await reviewService.listAppeals({
    filters: { status: req.query.status },
    page: req.query.page,
    limit: req.query.limit,
  });
  return paginatedResponse(res, 'Review appeals fetched', items, meta);
});

// POST /api/admin/review-appeals/:id/resolve
const resolveReviewAppeal = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const appeal = await reviewService.resolveAppeal(req.params.id, {
    decision: req.body.decision,
    adminNote: req.body.adminNote,
    adminUserId: adminId,
  });
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.review_appeal_resolved',
    entity: 'review_appeal',
    entityId: appeal.id,
    status: 'success',
    metadata: { decision: appeal.status, reviewId: appeal.reviewId },
  });
  return successResponse(res, 200, 'Appeal resolved', appeal);
});

module.exports = {
  getStats,
  getOverview,
  listUsers,
  updateUserStatus,
  getPendingProfessionals,
  approveProfessional,
  listFirms,
  listBookings,
  listAuditLogs,
  listPendingApprovals,
  getProfessionalApproval,
  approveProfessionalApplication,
  rejectProfessionalApplication,
  requestProfessionalInfo,
  listPendingFirms,
  getFirmApproval,
  approveFirmApplication,
  rejectFirmApplication,
  requestFirmModifications,
  listReviews,
  updateReview,
  deleteReview,
  listReviewAppeals,
  resolveReviewAppeal,
  getUser,
  getUserTransactions,
  createUser,
  updateUser,
  deleteUser,
  listLawFirms,
  getLawFirmDetail,
  createLawFirm,
  updateLawFirm,
  deleteLawFirm,
  setProfessionalFeatured,
};
