// adminService — wraps the platform-admin professional-approval endpoints
// (Phase 7). Every call returns the parsed `data` object from the API
// envelope `{ success, message, data, meta }`. The access token is attached
// automatically by api.js, so callers never pass tokens here.
//
// All of these endpoints require a `platform_admin` token.

import { apiRequest, get, post, patch, del } from '@/services/api';

/** Unwrap the API envelope and return its `data` payload (or the whole body). */
function unwrap(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

/**
 * List professionals awaiting approval.
 * @param {{ page?: number, limit?: number }} [params]
 * @returns {Promise<{ data: Array, meta: Object }>} the full envelope so
 *          callers can read both the rows and the pagination meta.
 */
export async function listPendingProfessionals({ page, limit } = {}) {
  const res = await get('/api/admin/professionals/pending', {
    params: { page, limit },
  });
  return {
    data: (res && res.data) || [],
    meta: (res && res.meta) || null,
  };
}

/**
 * Fetch the full review payload for one approval.
 * @param {string} approvalId
 * @returns {Promise<{approval,user,address,professionalDetail,lawyerDetail,taxConsultantDetail}>}
 */
export async function getProfessionalReview(approvalId) {
  const res = await get(`/api/admin/professionals/${approvalId}`);
  return unwrap(res);
}

/**
 * Approve a pending professional.
 * @param {string} approvalId
 * @returns {Promise<Object>}
 */
export async function approveProfessional(approvalId) {
  const res = await post(`/api/admin/professionals/${approvalId}/approve`);
  return unwrap(res);
}

/**
 * Reject a pending professional. A reason is required by the backend.
 * @param {string} approvalId
 * @param {string} reason
 * @returns {Promise<Object>}
 */
export async function rejectProfessional(approvalId, reason) {
  const res = await post(`/api/admin/professionals/${approvalId}/reject`, {
    reason,
  });
  return unwrap(res);
}

/**
 * Request more information from a pending professional. A message is required
 * by the backend.
 * @param {string} approvalId
 * @param {string} message
 * @returns {Promise<Object>}
 */
export async function requestProfessionalInfo(approvalId, message) {
  const res = await post(
    `/api/admin/professionals/${approvalId}/request-info`,
    { message }
  );
  return unwrap(res);
}

// ---------------------------------------------------------------------------
// Firm approvals (Phase 8)
// ---------------------------------------------------------------------------

/**
 * List law firms awaiting approval.
 * @param {{ page?: number, limit?: number }} [params]
 * @returns {Promise<{ data: Array, meta: Object }>} the full envelope so
 *          callers can read both the rows and the pagination meta.
 */
export async function listPendingFirms({ page, limit } = {}) {
  const res = await get('/api/admin/firms/pending', {
    params: { page, limit },
  });
  return {
    data: (res && res.data) || [],
    meta: (res && res.meta) || null,
  };
}

/**
 * Fetch the full review payload for one firm approval.
 * @param {string} approvalId
 * @returns {Promise<{ approval, lawFirm, owner }>}
 */
export async function getFirmReview(approvalId) {
  const res = await get(`/api/admin/firms/${approvalId}`);
  return unwrap(res);
}

/**
 * Approve a pending firm (the firm becomes ACTIVE).
 * @param {string} approvalId
 * @returns {Promise<Object>}
 */
export async function approveFirm(approvalId) {
  const res = await post(`/api/admin/firms/${approvalId}/approve`);
  return unwrap(res);
}

/**
 * Reject a pending firm. A reason is required by the backend.
 * @param {string} approvalId
 * @param {string} reason
 * @returns {Promise<Object>}
 */
export async function rejectFirm(approvalId, reason) {
  const res = await post(`/api/admin/firms/${approvalId}/reject`, {
    reason,
  });
  return unwrap(res);
}

/**
 * Request modifications from a pending firm. A message is required by the
 * backend.
 * @param {string} approvalId
 * @param {string} message
 * @returns {Promise<Object>}
 */
export async function requestFirmModifications(approvalId, message) {
  const res = await post(
    `/api/admin/firms/${approvalId}/request-modifications`,
    { message }
  );
  return unwrap(res);
}

// ---------------------------------------------------------------------------
// Platform admin — overview, user management & audit logs (Phase 9)
// ---------------------------------------------------------------------------

/**
 * Fetch the consolidated admin overview (users, professionals, firms,
 * invitations and recent audit logs).
 * @returns {Promise<Object>} the `data` payload from the API envelope.
 */
export async function getAdminOverview() {
  const res = await get('/api/admin/overview');
  return unwrap(res);
}

/**
 * List all platform users with optional filters and pagination.
 * @param {{ page?: number, limit?: number, role?: string, status?: string,
 *           search?: string }} [params]
 * @returns {Promise<{ data: Array, meta: Object }>} the rows and the
 *          pagination meta.
 */
export async function listUsers({ page, limit, role, status, search } = {}) {
  const res = await get('/api/admin/users', {
    params: { page, limit, role, status, search },
  });
  return {
    data: (res && res.data) || [],
    meta: (res && res.meta) || null,
  };
}

/**
 * List audit-log entries with optional filters and pagination (newest first).
 * @param {{ page?: number, limit?: number, action?: string, status?: string,
 *           userId?: string }} [params]
 * @returns {Promise<{ data: Array, meta: Object }>} the rows and the
 *          pagination meta.
 */
export async function getAuditLogs({
  page,
  limit,
  action,
  status,
  userId,
} = {}) {
  const res = await get('/api/admin/audit-logs', {
    params: { page, limit, action, status, userId },
  });
  return {
    data: (res && res.data) || [],
    meta: (res && res.meta) || null,
  };
}

/**
 * Update a user's account status.
 * @param {string} userId
 * @param {'active'|'suspended'} status
 * @returns {Promise<Object>} the updated user.
 */
export async function updateUserStatus(userId, status) {
  const res = await patch(`/api/admin/users/${userId}/status`, { status });
  return unwrap(res);
}

/** Fetch one user by id (sanitized — no password). */
export async function getUser(id) {
  const res = await get(`/api/admin/users/${id}`);
  return unwrap(res);
}

/**
 * Fetch a user's full transaction history: booking payments (both as
 * payer and payee), subscription payments, and payout requests, plus
 * pre-aggregated totals.
 */
export async function getUserTransactions(id) {
  const res = await get(`/api/admin/users/${id}/transactions`);
  return unwrap(res);
}

/**
 * Admin: grant a user a subscription manually for a fixed time window.
 * Body shape:
 *   { planId | planSlug, billingCycle, endDate?, amountPaid?, adminNotes? }
 * Cancels the user's prior active subscription (including any Razorpay
 * mandate) before recording the new active row.
 */
export async function adminActivateUserSubscription(userId, body) {
  const res = await post(`/api/admin/users/${userId}/subscription`, body);
  const data = unwrap(res);
  return (data && data.subscription) || null;
}

/** Create a user. Body: { email, password, role, firstName, lastName, mobileNumber? }. */
export async function createUser(data) {
  const res = await post('/api/admin/users', data);
  return unwrap(res);
}

/** Edit a user. Body may include name fields, email, role, mobileNumber, password, emailVerified. */
export async function updateUser(id, changes) {
  const res = await patch(`/api/admin/users/${id}`, changes);
  return unwrap(res);
}

/**
 * Mark a user's email as verified (admin override). Promotes the user to
 * `active` if they were still `pending_verification`.
 */
export async function markUserEmailVerified(id) {
  const res = await patch(`/api/admin/users/${id}`, { emailVerified: true });
  return unwrap(res);
}

/** Delete a user. */
export async function deleteUser(id) {
  const res = await del(`/api/admin/users/${id}`);
  return unwrap(res);
}

// ---------------------------------------------------------------------------
// Admin firms (law_firms) — full CRUD, separate from the approval workflow.
// ---------------------------------------------------------------------------

/**
 * List every firm with optional filters and pagination.
 * @param {{ page?, limit?, search?, status? }} [params]
 * @returns {Promise<{ data: Array, meta: Object }>}
 */
export async function listLawFirms({ page, limit, search, status } = {}) {
  const res = await get('/api/admin/law-firms', {
    params: { page, limit, search, status },
  });
  return {
    data: (res && res.data) || [],
    meta: (res && res.meta) || null,
  };
}

/** Fetch one firm by id (with owner + member list). */
export async function getLawFirm(id) {
  const res = await get(`/api/admin/law-firms/${id}`);
  return unwrap(res);
}

/** Create a firm. `ownerUserId` is optional. */
export async function createLawFirm(data) {
  const res = await post('/api/admin/law-firms', data);
  return unwrap(res);
}

/** Edit a firm. */
export async function updateLawFirm(id, changes) {
  const res = await patch(`/api/admin/law-firms/${id}`, changes);
  return unwrap(res);
}

/** Delete a firm (cascades members / invitations / join requests). */
export async function deleteLawFirm(id) {
  const res = await del(`/api/admin/law-firms/${id}`);
  return unwrap(res);
}

// ---------------------------------------------------------------------------
// Reviews & review appeals (admin-only)
// ---------------------------------------------------------------------------

/**
 * List every review with optional filters and pagination.
 * @param {{ page?, limit?, status?, minRating? }} [params]
 * @returns {Promise<{ data: Array, meta: Object }>}
 */
export async function listReviews({
  page,
  limit,
  status,
  minRating,
  kind,
} = {}) {
  const res = await get('/api/admin/reviews', {
    params: { page, limit, status, minRating, kind },
  });
  return {
    data: (res && res.data) || [],
    meta: (res && res.meta) || null,
  };
}

/**
 * Edit a review's rating / comment.
 * @param {string} id
 * @param {{ rating?: number, comment?: string }} changes
 */
export async function updateReview(id, changes) {
  const res = await patch(`/api/admin/reviews/${id}`, changes);
  return unwrap(res);
}

/** Delete a review. */
export async function deleteReview(id) {
  const res = await del(`/api/admin/reviews/${id}`);
  return unwrap(res);
}

/**
 * List every review appeal with optional filters and pagination.
 * @param {{ page?, limit?, status? }} [params]
 * @returns {Promise<{ data: Array, meta: Object }>}
 */
export async function listReviewAppeals({ page, limit, status } = {}) {
  const res = await get('/api/admin/review-appeals', {
    params: { page, limit, status },
  });
  return {
    data: (res && res.data) || [],
    meta: (res && res.meta) || null,
  };
}

/**
 * Resolve a review appeal.
 * @param {string} id
 * @param {{ decision: 'accept'|'reject', adminNote?: string }} payload
 */
export async function resolveReviewAppeal(id, { decision, adminNote }) {
  const res = await post(`/api/admin/review-appeals/${id}/resolve`, {
    decision,
    adminNote,
  });
  return unwrap(res);
}

export default {
  listPendingProfessionals,
  getProfessionalReview,
  approveProfessional,
  rejectProfessional,
  requestProfessionalInfo,
  listPendingFirms,
  getFirmReview,
  approveFirm,
  rejectFirm,
  requestFirmModifications,
  getAdminOverview,
  listUsers,
  getAuditLogs,
  updateUserStatus,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  listReviews,
  updateReview,
  deleteReview,
  listReviewAppeals,
  resolveReviewAppeal,
  listLawFirms,
  getLawFirm,
  createLawFirm,
  updateLawFirm,
  deleteLawFirm,
};
