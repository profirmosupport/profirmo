const clientService = require('../services/clientService');
const asyncHandler = require('../utils/asyncHandler');
const {
  successResponse,
  paginatedResponse,
} = require('../utils/responseHandler');

const notFound = (id) => ({
  statusCode: 404,
  message: `Client not found: ${id}`,
});

// GET /api/clients — scoped to the calling professional via professional_clients.
const listClients = asyncHandler(async (req, res) => {
  const { page, limit, ...filters } = req.query;
  const { items, ...meta } = await clientService.list({
    filters,
    page,
    limit,
    actor: req.user,
  });
  return paginatedResponse(res, 'Clients fetched', items, meta);
});

// GET /api/clients/:id
const getClient = asyncHandler(async (req, res) => {
  const client = await clientService.getById(req.params.id);
  if (!client) throw notFound(req.params.id);
  return successResponse(res, 200, 'Client fetched', client);
});

// POST /api/clients
const createClient = asyncHandler(async (req, res) => {
  const client = await clientService.create(req.body, req.user);
  return successResponse(res, 201, 'Client created', client);
});

// PATCH /api/clients/:id
const updateClient = asyncHandler(async (req, res) => {
  const client = await clientService.update(req.params.id, req.body);
  if (!client) throw notFound(req.params.id);
  return successResponse(res, 200, 'Client updated', client);
});

// POST /api/clients/:id/link — link an existing client-user to the caller.
const linkClient = asyncHandler(async (req, res) => {
  const client = await clientService.linkToProfessional(
    req.params.id,
    req.user
  );
  return successResponse(res, 200, 'Client linked', client);
});

// GET /api/clients/search-by-phone?phone=+91...
// Look up an existing platform user by mobileNumber so professionals can
// "find or create" a client from a phone number in the Add-Client flow.
const searchByPhone = asyncHandler(async (req, res) => {
  const result = await clientService.searchByPhone(req.query.phone);
  return successResponse(res, 200, 'Phone lookup complete', result);
});

module.exports = {
  listClients,
  getClient,
  createClient,
  updateClient,
  linkClient,
  searchByPhone,
};
