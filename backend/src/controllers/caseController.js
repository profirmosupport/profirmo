const caseService = require('../services/caseService');
const asyncHandler = require('../utils/asyncHandler');
const {
  successResponse,
  paginatedResponse,
} = require('../utils/responseHandler');

// GET /api/cases
const listCases = asyncHandler(async (req, res) => {
  const { page, limit, ...filters } = req.query;
  const { items, ...meta } = caseService.list({ filters, page, limit });
  return paginatedResponse(res, 'Cases fetched', items, meta);
});

// GET /api/cases/:id
const getCase = asyncHandler(async (req, res) => {
  const found = caseService.getById(req.params.id);
  return successResponse(res, 200, 'Case fetched', found);
});

// POST /api/cases
const createCase = asyncHandler(async (req, res) => {
  const created = caseService.create(req.body);
  return successResponse(res, 201, 'Case created', created);
});

// PATCH /api/cases/:id
const updateCase = asyncHandler(async (req, res) => {
  const updated = caseService.update(req.params.id, req.body);
  return successResponse(res, 200, 'Case updated', updated);
});

// DELETE /api/cases/:id
const deleteCase = asyncHandler(async (req, res) => {
  const removed = caseService.remove(req.params.id);
  return successResponse(res, 200, 'Case deleted', removed);
});

// GET /api/cases/client/:clientId
const getCasesByClient = asyncHandler(async (req, res) => {
  const cases = caseService.getByClient(req.params.clientId);
  return successResponse(res, 200, 'Client cases fetched', cases);
});

// GET /api/cases/professional/:professionalId
const getCasesByProfessional = asyncHandler(async (req, res) => {
  const cases = caseService.getByProfessional(req.params.professionalId);
  return successResponse(res, 200, 'Professional cases fetched', cases);
});

module.exports = {
  listCases,
  getCase,
  createCase,
  updateCase,
  deleteCase,
  getCasesByClient,
  getCasesByProfessional,
};
