const asyncHandler = require('../utils/asyncHandler');
const {
  successResponse,
  paginatedResponse,
} = require('../utils/responseHandler');
const { logAudit } = require('../utils/auditLogger');
const leadService = require('../services/leadService');

// HttpOnly cookie that flags "this visitor already submitted the lead form".
// /api/leads/me reads it to decide whether the gated advanced-search popup
// should re-appear. 90 days is long enough to skip the popup on repeat
// visits but short enough that the data refreshes for new campaigns.
const LEAD_COOKIE = 'pf_lead';
const LEAD_COOKIE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function setLeadCookie(res, leadId) {
  res.cookie(LEAD_COOKIE, leadId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: LEAD_COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

// POST /api/leads  (public)
const captureLead = asyncHandler(async (req, res) => {
  const { fullName, email, phone, source, message, firmId } = req.body || {};
  const result = await leadService.capturePublic({
    fullName,
    email,
    phone,
    source,
    message,
    firmId,
  });
  setLeadCookie(res, result.lead.id);
  return successResponse(res, 201, 'Lead captured', {
    lead: { id: result.lead.id, fullName: result.lead.fullName },
    deduped: result.deduped,
  });
});

// GET /api/leads/me  (public — reads the cookie)
// Returns { hasLead: bool } so the frontend can decide whether to gate the
// advanced-search popup. Never reveals lead contents to the visitor.
const getMyLead = asyncHandler(async (req, res) => {
  const id = req.cookies && req.cookies[LEAD_COOKIE];
  if (!id) return successResponse(res, 200, 'OK', { hasLead: false });
  const lead = await leadService.getLeadById(id);
  if (!lead) {
    res.clearCookie(LEAD_COOKIE, { path: '/' });
    return successResponse(res, 200, 'OK', { hasLead: false });
  }
  return successResponse(res, 200, 'OK', { hasLead: true });
});

// --- Admin: leads ---------------------------------------------------------

const adminListLeads = asyncHandler(async (req, res) => {
  const { rows, page, limit, total } = await leadService.listLeads({
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search,
    status: req.query.status,
    source: req.query.source,
    assignedTo: req.query.assignedTo,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
  });
  return paginatedResponse(res, 'Leads fetched', rows, { page, limit, total });
});

const adminGetLead = asyncHandler(async (req, res) => {
  const lead = await leadService.getLeadById(req.params.id);
  if (!lead) {
    throw { statusCode: 404, message: 'Lead not found' };
  }
  return successResponse(res, 200, 'Lead fetched', lead);
});

const adminCreateLead = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const lead = await leadService.adminCreateLead(req.body || {}, adminId);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.lead_created',
    entity: 'lead',
    entityId: lead.id,
    status: 'success',
    metadata: { email: lead.email },
  });
  return successResponse(res, 201, 'Lead created', lead);
});

const adminUpdateLead = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const lead = await leadService.updateLead(
    req.params.id,
    req.body || {},
    adminId
  );
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.lead_updated',
    entity: 'lead',
    entityId: lead.id,
    status: 'success',
    metadata: { fields: Object.keys(req.body || {}) },
  });
  return successResponse(res, 200, 'Lead updated', lead);
});

const adminDeleteLead = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const result = await leadService.deleteLead(req.params.id, adminId);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.lead_deleted',
    entity: 'lead',
    entityId: req.params.id,
    status: 'success',
    metadata: {},
  });
  return successResponse(res, 200, 'Lead deleted', result);
});

const adminAddLeadNote = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const activity = await leadService.addNote(
    'lead',
    req.params.id,
    (req.body && req.body.message) || '',
    adminId
  );
  return successResponse(res, 201, 'Note added', activity);
});

const adminListLeadActivities = asyncHandler(async (req, res) => {
  const rows = await leadService.listActivities('lead', req.params.id);
  return successResponse(res, 200, 'Activities fetched', rows);
});

const adminConvertLead = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const opp = await leadService.convertLeadToOpportunity(
    req.params.id,
    adminId
  );
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.lead_converted_to_opportunity',
    entity: 'lead',
    entityId: req.params.id,
    status: 'success',
    metadata: { opportunityId: opp.id },
  });
  return successResponse(res, 201, 'Lead converted to opportunity', opp);
});

// --- Admin: opportunities -------------------------------------------------

const adminListOpportunities = asyncHandler(async (req, res) => {
  const { rows, page, limit, total } = await leadService.listOpportunities({
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search,
    status: req.query.status,
    assignedTo: req.query.assignedTo,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
  });
  return paginatedResponse(res, 'Opportunities fetched', rows, {
    page,
    limit,
    total,
  });
});

const adminGetOpportunity = asyncHandler(async (req, res) => {
  const opp = await leadService.getOpportunityById(req.params.id);
  if (!opp) {
    throw { statusCode: 404, message: 'Opportunity not found' };
  }
  return successResponse(res, 200, 'Opportunity fetched', opp);
});

const adminUpdateOpportunity = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const opp = await leadService.updateOpportunity(
    req.params.id,
    req.body || {},
    adminId
  );
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.opportunity_updated',
    entity: 'opportunity',
    entityId: opp.id,
    status: 'success',
    metadata: { fields: Object.keys(req.body || {}) },
  });
  return successResponse(res, 200, 'Opportunity updated', opp);
});

const adminDeleteOpportunity = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const result = await leadService.deleteOpportunity(req.params.id, adminId);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.opportunity_deleted',
    entity: 'opportunity',
    entityId: req.params.id,
    status: 'success',
    metadata: {},
  });
  return successResponse(res, 200, 'Opportunity deleted', result);
});

const adminAddOpportunityNote = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const activity = await leadService.addNote(
    'opportunity',
    req.params.id,
    (req.body && req.body.message) || '',
    adminId
  );
  return successResponse(res, 201, 'Note added', activity);
});

const adminListOpportunityActivities = asyncHandler(async (req, res) => {
  const rows = await leadService.listActivities('opportunity', req.params.id);
  return successResponse(res, 200, 'Activities fetched', rows);
});

const adminConvertOpportunity = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const result = await leadService.convertOpportunityToClient(
    req.params.id,
    adminId
  );
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.opportunity_converted_to_client',
    entity: 'opportunity',
    entityId: req.params.id,
    status: 'success',
    metadata: { clientUserId: result.clientUserId },
  });
  return successResponse(res, 201, 'Opportunity converted to client', result);
});

module.exports = {
  captureLead,
  getMyLead,
  adminListLeads,
  adminGetLead,
  adminCreateLead,
  adminUpdateLead,
  adminDeleteLead,
  adminAddLeadNote,
  adminListLeadActivities,
  adminConvertLead,
  adminListOpportunities,
  adminGetOpportunity,
  adminUpdateOpportunity,
  adminDeleteOpportunity,
  adminAddOpportunityNote,
  adminListOpportunityActivities,
  adminConvertOpportunity,
};
