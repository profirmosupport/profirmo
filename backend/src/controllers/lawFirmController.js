const lawFirmService = require('../services/lawFirmService');
const invitationService = require('../services/invitationService');
const leadService = require('../services/leadService');
const clientService = require('../services/clientService');
const gates = require('../services/subscriptionGateService');
const { Lead } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');

// Catch plan-limit errors locally so the response body carries the
// machine-readable `code` field. The shared error handler would otherwise
// strip everything beyond {statusCode, message, errors}.
function planLimitJson(res, err) {
  return res.status(err.statusCode || 403).json({
    success: false,
    message: err.message,
    errors: null,
    code: err.code,
    feature: err.feature,
    planName: err.planName,
    limit: err.limit,
    currentCount: err.currentCount,
  });
}

// GET /api/law-firm/mine — the caller's firm + members + role + approval.
const getMyFirm = asyncHandler(async (req, res) => {
  const result = await lawFirmService.getMyFirm(req.user.id);
  return successResponse(res, 200, 'Law firm fetched', result);
});

// POST /api/law-firm — create the caller's firm (gated on approved pro).
const createFirm = asyncHandler(async (req, res) => {
  // Subscription gate — firm_creation_allowed + firm_limit on the user's
  // active plan.
  try {
    await gates.enforceCanCreateFirm(req.user.id);
  } catch (err) {
    if (err && err.code === 'PLAN_LIMIT_REACHED') return planLimitJson(res, err);
    throw err;
  }
  const result = await lawFirmService.createFirm(req.user, req.body);
  return successResponse(res, 201, 'Law firm submitted for approval', result);
});

// PUT /api/law-firm/mine — update the caller's firm (owner only).
const updateFirm = asyncHandler(async (req, res) => {
  const result = await lawFirmService.updateFirm(req.user.id, req.body);
  return successResponse(res, 200, 'Law firm updated', result);
});

// GET /api/law-firm/mine/members — list firm members.
const getMembers = asyncHandler(async (req, res) => {
  const members = await lawFirmService.getMembers(req.user.id);
  return successResponse(res, 200, 'Firm members fetched', { members });
});

// GET /api/law-firm/mine/clients — aggregated clients of every firm member.
const getFirmClients = asyncHandler(async (req, res) => {
  const result = await lawFirmService.getFirmClients(req.user.id);
  return successResponse(res, 200, 'Firm clients fetched', result);
});

// GET /api/law-firm/mine/payments — payments received by every firm member.
const getFirmPayments = asyncHandler(async (req, res) => {
  const result = await lawFirmService.getFirmPayments(req.user.id);
  return successResponse(res, 200, 'Firm payments fetched', result);
});

// GET /api/law-firm/mine/reviews — collective reviews of every firm member,
// each decorated with the reviewed pro's name + latest appeal state.
const getFirmReviews = asyncHandler(async (req, res) => {
  const result = await lawFirmService.getFirmReviews(req.user.id);
  return successResponse(res, 200, 'Firm reviews fetched', result);
});

// GET /api/law-firm/mine/leads — inquiries submitted via the firm-profile
// "Contact firm" modal. Returns an empty list when the caller has no firm.
const getMyFirmLeads = asyncHandler(async (req, res) => {
  const my = await lawFirmService.getMyFirm(req.user.id);
  const firm = my && my.lawFirm;
  if (!firm) {
    return successResponse(res, 200, 'Firm leads fetched', { leads: [] });
  }
  const leads = await leadService.listLeadsByFirm(firm.id);
  return successResponse(res, 200, 'Firm leads fetched', { leads });
});

// POST /api/law-firm/mine/leads/:leadId/add-client
// Convert a lead into a firm client. clientService.create already reuses an
// existing client-user matched by email/phone (no duplicates) and creates a
// fresh client-user otherwise; we then link the lead row to the resulting
// client and flip its status to Converted so the firm sees the pipeline move.
const addLeadAsClient = asyncHandler(async (req, res) => {
  const my = await lawFirmService.getMyFirm(req.user.id);
  const firm = my && my.lawFirm;
  if (!firm) {
    throw { statusCode: 404, message: 'You do not own a firm.' };
  }
  const lead = await Lead.findByPk(req.params.leadId);
  if (!lead) throw { statusCode: 404, message: 'Lead not found.' };
  if (lead.firmId !== firm.id) {
    throw {
      statusCode: 403,
      message: 'This lead was not submitted to your firm.',
    };
  }

  const client = await clientService.create(
    {
      name: lead.fullName,
      email: lead.email,
      phone: lead.phone,
    },
    req.user
  );

  await lead.update({
    status: 'Converted',
    clientId: client.id,
    convertedAt: new Date(),
  });

  return successResponse(res, 201, 'Lead added as client', {
    client,
    lead: lead.get({ plain: true }),
  });
});

// POST /api/law-firm/mine/members — DEPRECATED: superseded by invitations.
const addMember = asyncHandler(async (req, res) => {
  throw {
    statusCode: 410,
    message:
      'Adding members directly is no longer supported. Use firm invitations: POST /api/law-firm/mine/invitations',
  };
});

// PATCH /api/law-firm/mine/members/:memberId/role — owner only.
const changeMemberRole = asyncHandler(async (req, res) => {
  const member = await lawFirmService.changeMemberRole(
    req.user.id,
    req.params.memberId,
    req.body
  );
  return successResponse(res, 200, 'Member role updated', { member });
});

// DELETE /api/law-firm/mine/members/:memberId — owner or co-owner.
const removeMember = asyncHandler(async (req, res) => {
  const result = await lawFirmService.removeMember(
    req.user.id,
    req.params.memberId
  );
  return successResponse(res, 200, 'Firm member removed', result);
});

// GET /api/law-firm/search-professionals?q= — search approved professionals.
const searchProfessionals = asyncHandler(async (req, res) => {
  const results = await lawFirmService.searchProfessionals(
    req.user.id,
    req.query.q
  );
  return successResponse(res, 200, 'Professionals fetched', { results });
});

// --- Firm-side invitation endpoints ---------------------------------------

// POST /api/law-firm/mine/invitations — owner / co-owner.
const createInvitation = asyncHandler(async (req, res) => {
  // Subscription gate: cap firm size at the owner's professionals_allowed
  // limit. Resolve the caller's firm first so the gate knows which roster
  // to count against.
  try {
    const my = await lawFirmService.getMyFirm(req.user.id);
    const firmId = my && my.lawFirm && my.lawFirm.id;
    if (firmId) await gates.enforceCanAddFirmMember(firmId);
  } catch (err) {
    if (err && err.code === 'PLAN_LIMIT_REACHED') return planLimitJson(res, err);
    throw err;
  }
  const invitation = await invitationService.createInvitation(
    req.user.id,
    req.body
  );
  return successResponse(res, 201, 'Invitation sent', { invitation });
});

// GET /api/law-firm/mine/invitations — list the firm's invitations.
const listFirmInvitations = asyncHandler(async (req, res) => {
  const invitations = await invitationService.listFirmInvitations(
    req.user.id
  );
  return successResponse(res, 200, 'Firm invitations fetched', {
    invitations,
  });
});

// DELETE /api/law-firm/mine/invitations/:id — owner / co-owner cancel.
const cancelInvitation = asyncHandler(async (req, res) => {
  const invitation = await invitationService.cancelInvitation(
    req.user.id,
    req.params.id
  );
  return successResponse(res, 200, 'Invitation cancelled', { invitation });
});

module.exports = {
  getMyFirm,
  createFirm,
  updateFirm,
  getMembers,
  getFirmClients,
  getFirmPayments,
  getFirmReviews,
  getMyFirmLeads,
  addLeadAsClient,
  addMember,
  changeMemberRole,
  removeMember,
  searchProfessionals,
  createInvitation,
  listFirmInvitations,
  cancelInvitation,
};
