// attestrController — HTTP layer for the Attestr proxy. Mounted at
// /api/attestr. All endpoints public (no app auth) — the partner
// token lives server-side. Rate limiting via the global limiter.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const attestrService = require('../services/attestrService');

// POST /api/attestr/unified-case
const unifiedCase = asyncHandler(async (req, res) => {
  const upstream = await attestrService.unifiedCaseDetails(req.body || {});
  return successResponse(res, 200, 'Attestr case details', upstream);
});

// GET /api/attestr/court-types — small helper so the form can render the
// allowed values without hard-coding the list on the client.
const courtTypes = asyncHandler(async (_req, res) => {
  return successResponse(res, 200, 'Court types', {
    items: attestrService.COURT_TYPES,
  });
});

module.exports = { unifiedCase, courtTypes };
