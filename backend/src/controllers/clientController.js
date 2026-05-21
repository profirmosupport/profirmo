const clientService = require('../services/clientService');
const asyncHandler = require('../utils/asyncHandler');
const {
  successResponse,
  paginatedResponse,
} = require('../utils/responseHandler');

// GET /api/clients
const listClients = asyncHandler(async (req, res) => {
  const { page, limit, ...filters } = req.query;
  const { items, ...meta } = clientService.list({ filters, page, limit });
  return paginatedResponse(res, 'Clients fetched', items, meta);
});

// GET /api/clients/:id
const getClient = asyncHandler(async (req, res) => {
  const client = clientService.getById(req.params.id);
  return successResponse(res, 200, 'Client fetched', client);
});

// POST /api/clients
const createClient = asyncHandler(async (req, res) => {
  const client = clientService.create(req.body);
  return successResponse(res, 201, 'Client created', client);
});

// PATCH /api/clients/:id
const updateClient = asyncHandler(async (req, res) => {
  const client = clientService.update(req.params.id, req.body);
  return successResponse(res, 200, 'Client updated', client);
});

module.exports = { listClients, getClient, createClient, updateClient };
