// complianceController — HTTP layer for client compliance profiles +
// generated obligations. All routes are scoped to the calling
// professional's ProfessionalDetail.id, resolved via
// myProfessionalId() so a pro can only touch their own client work.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const compliance = require('../services/complianceObligationService');
const auditService = require('../services/auditService');
const { ProfessionalDetail } = require('../models');

async function myProfessionalId(userId) {
  const detail = await ProfessionalDetail.findOne({
    where: { userId },
    attributes: ['id'],
    raw: true,
  });
  return detail ? detail.id : null;
}

const getProfile = asyncHandler(async (req, res) => {
  const proId = await myProfessionalId(req.user.id);
  if (!proId) throw { statusCode: 403, message: 'Only professionals can access compliance profiles.' };
  const profile = await compliance.getProfile(proId, req.params.clientUserId);
  return successResponse(res, 200, 'Compliance profile', profile);
});

const putProfile = asyncHandler(async (req, res) => {
  const proId = await myProfessionalId(req.user.id);
  if (!proId) throw { statusCode: 403, message: 'Only professionals can edit compliance profiles.' };
  const before = await compliance.getProfile(proId, req.params.clientUserId);
  const profile = await compliance.upsertProfile(
    proId,
    req.params.clientUserId,
    req.body || {}
  );
  auditService.recordUpdate({
    req,
    entityType: 'compliance_profile',
    entityId: profile.id,
    before: before || {},
    after: profile,
  });
  return successResponse(res, 200, 'Compliance profile saved', profile);
});

const generate = asyncHandler(async (req, res) => {
  const proId = await myProfessionalId(req.user.id);
  if (!proId) throw { statusCode: 403, message: 'Only professionals can generate compliance obligations.' };
  const out = await compliance.generateForClient(
    proId,
    req.params.clientUserId
  );
  return successResponse(res, 200, 'Generated upcoming obligations', out);
});

const listMine = asyncHandler(async (req, res) => {
  const proId = await myProfessionalId(req.user.id);
  if (!proId) return successResponse(res, 200, 'Compliance obligations', []);
  const items = await compliance.listForProfessional(proId, {
    from: req.query.from,
    to: req.query.to,
    status: req.query.status,
  });
  return successResponse(res, 200, 'Compliance obligations', items);
});

const updateObligation = asyncHandler(async (req, res) => {
  const proId = await myProfessionalId(req.user.id);
  if (!proId) throw { statusCode: 403, message: 'Only professionals can update obligations.' };
  const row = await compliance.updateObligation(
    proId,
    req.params.id,
    {
      ...(req.body || {}),
      completedByUserId:
        req.body && req.body.status === 'done' ? req.user.id : undefined,
    }
  );
  return successResponse(res, 200, 'Obligation updated', row);
});

module.exports = {
  getProfile,
  putProfile,
  generate,
  listMine,
  updateObligation,
};
