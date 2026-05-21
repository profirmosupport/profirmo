const firmService = require('../services/firmService');
const asyncHandler = require('../utils/asyncHandler');
const {
  successResponse,
  paginatedResponse,
} = require('../utils/responseHandler');

// GET /api/firms
const listFirms = asyncHandler(async (req, res) => {
  const { page, limit, ...filters } = req.query;
  const { items, ...meta } = firmService.list({ filters, page, limit });
  return paginatedResponse(res, 'Firms fetched', items, meta);
});

// GET /api/firms/:id
const getFirm = asyncHandler(async (req, res) => {
  const firm = firmService.getById(req.params.id);
  return successResponse(res, 200, 'Firm fetched', firm);
});

// GET /api/firms/:id/professionals
const getFirmProfessionals = asyncHandler(async (req, res) => {
  const professionals = firmService.getProfessionals(req.params.id);
  return successResponse(res, 200, 'Firm professionals fetched', professionals);
});

// POST /api/firms/:id/professionals
const addFirmProfessional = asyncHandler(async (req, res) => {
  const professional = firmService.addProfessional(req.params.id, req.body);
  return successResponse(
    res,
    201,
    'Professional added to firm',
    professional
  );
});

// GET /api/firms/:id/clients
const getFirmClients = asyncHandler(async (req, res) => {
  const clients = firmService.getClients(req.params.id);
  return successResponse(res, 200, 'Firm clients fetched', clients);
});

// GET /api/firms/:id/cases
const getFirmCases = asyncHandler(async (req, res) => {
  const cases = firmService.getCases(req.params.id);
  return successResponse(res, 200, 'Firm cases fetched', cases);
});

module.exports = {
  listFirms,
  getFirm,
  getFirmProfessionals,
  addFirmProfessional,
  getFirmClients,
  getFirmCases,
};
