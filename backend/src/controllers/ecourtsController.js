// ecourtsController — HTTP layer for the E-Courts India proxy.
// All endpoints are PUBLIC (no auth required) — the partner key lives
// server-side and is the only credential needed. Rate limiting is
// handled by the shared globalLimiter middleware.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const ecourtsService = require('../services/ecourtsService');

// GET /api/ecourts/search
const search = asyncHandler(async (req, res) => {
  const data = await ecourtsService.search(req.query);
  return successResponse(res, 200, 'E-Courts search results', data);
});

// GET /api/ecourts/case/:cnr
const getCase = asyncHandler(async (req, res) => {
  const data = await ecourtsService.getCase(req.params.cnr);
  if (!data) {
    throw { statusCode: 404, message: `Case not found: ${req.params.cnr}` };
  }
  return successResponse(res, 200, 'Case detail', data);
});

// GET /api/ecourts/case/:cnr/order/:filename/download
// Streams the watermarked PDF binary back to the browser.
const downloadOrder = asyncHandler(async (req, res) => {
  const { cnr, filename } = req.params;
  const { pdfBuffer, downloadFilename } = await ecourtsService.getOrderPdf(
    cnr,
    filename
  );
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', pdfBuffer.length);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${downloadFilename.replace(/"/g, '')}"`
  );
  // The upstream call is slow (up to 5 min for new orders). Disable
  // intermediate caching so each click goes to source.
  res.setHeader('Cache-Control', 'private, no-store');
  return res.end(pdfBuffer);
});

// --- Favourites (signed-in users) ----------------------------------------

const listFavorites = asyncHandler(async (req, res) => {
  const items = await ecourtsService.listFavorites(req.user.id);
  return successResponse(res, 200, 'Favourites', { items });
});

const addFavorite = asyncHandler(async (req, res) => {
  const { cnr, snapshot } = req.body || {};
  const row = await ecourtsService.addFavorite(req.user.id, cnr, snapshot);
  return successResponse(res, 201, 'Favourite saved', row);
});

const removeFavorite = asyncHandler(async (req, res) => {
  await ecourtsService.removeFavorite(req.user.id, req.params.cnr);
  return successResponse(res, 200, 'Favourite removed', {});
});

// --- Imported-case lookup (so the UI can swap the Save CTA) -------------

const getImportedCase = asyncHandler(async (req, res) => {
  const row = await ecourtsService.findImportedCase(req.user, req.params.cnr);
  return successResponse(
    res,
    200,
    row ? 'Case already imported' : 'Not imported yet',
    {
      imported: !!row,
      caseId: row ? row.id : null,
      role: String(req.user.role || '').toLowerCase(),
    }
  );
});

// --- Import into the Cases module (signed-in users; gated by plan) ------

const importCase = asyncHandler(async (req, res) => {
  const { cnr } = req.body || {};
  const result = await ecourtsService.importCase(req.user, cnr);
  return successResponse(
    res,
    result.reused ? 200 : 201,
    result.reused
      ? 'Case already saved to your dashboard'
      : 'Case saved to your dashboard',
    result
  );
});

// --- Refresh a saved case from upstream -----------------------------------

const syncCase = asyncHandler(async (req, res) => {
  const result = await ecourtsService.syncCase(req.params.id, req.user);
  return successResponse(res, 200, 'Case refreshed from E-Courts', result);
});

module.exports = {
  search,
  getCase,
  downloadOrder,
  listFavorites,
  addFavorite,
  removeFavorite,
  getImportedCase,
  importCase,
  syncCase,
};
