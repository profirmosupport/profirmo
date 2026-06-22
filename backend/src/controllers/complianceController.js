// complianceController — HTTP layer for client compliance profiles +
// generated obligations. All routes are scoped to the calling
// professional's ProfessionalDetail.id, resolved via
// myProfessionalId() so a pro can only touch their own client work.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const compliance = require('../services/complianceObligationService');
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
  const profile = await compliance.upsertProfile(
    proId,
    req.params.clientUserId,
    req.body || {}
  );
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

// --- Requirements catalog -------------------------------------------

const requirementsCatalog = require('../config/entityTypeRequirements');

const getRequirements = asyncHandler(async (req, res) => {
  const out = requirementsCatalog.getRequirements(req.params.entityType);
  if (!out) {
    throw {
      statusCode: 404,
      message: `Unknown entity type: ${req.params.entityType}`,
    };
  }
  return successResponse(res, 200, 'Requirements catalog', out);
});

const listEntities = asyncHandler(async (req, res) => {
  return successResponse(
    res,
    200,
    'Entity types',
    requirementsCatalog.listEntities()
  );
});

// --- Client self read/write -----------------------------------------

const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await compliance.getMyProfile(req.user.id);
  return successResponse(res, 200, 'My compliance profile', profile);
});

const putMyProfile = asyncHandler(async (req, res) => {
  const out = await compliance.upsertMyProfile(req.user.id, req.body || {});
  return successResponse(res, 200, 'Profile updated', out);
});

const listMyObligations = asyncHandler(async (req, res) => {
  const items = await compliance.listForClient(req.user.id, {
    from: req.query.from,
    to: req.query.to,
    status: req.query.status,
  });
  return successResponse(res, 200, 'My compliance obligations', items);
});

module.exports = {
  getProfile,
  putProfile,
  generate,
  listMine,
  updateObligation,
  getRequirements,
  listEntities,
  getMyProfile,
  putMyProfile,
  listMyObligations,
};
