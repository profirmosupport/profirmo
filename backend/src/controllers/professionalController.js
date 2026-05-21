const professionalService = require('../services/professionalService');
const asyncHandler = require('../utils/asyncHandler');
const {
  successResponse,
  paginatedResponse,
} = require('../utils/responseHandler');

// GET /api/professionals
const listProfessionals = asyncHandler(async (req, res) => {
  const { page, limit, ...filters } = req.query;
  const { items, ...meta } = professionalService.list({
    filters,
    page,
    limit,
  });
  return paginatedResponse(res, 'Professionals fetched', items, meta);
});

// GET /api/professionals/search
const searchProfessionals = asyncHandler(async (req, res) => {
  const results = professionalService.search(req.query.q || req.query.query);
  return successResponse(res, 200, 'Search results', results);
});

// GET /api/professionals/:id
const getProfessional = asyncHandler(async (req, res) => {
  const professional = professionalService.getById(req.params.id);
  return successResponse(res, 200, 'Professional fetched', professional);
});

// GET /api/professionals/:id/reviews
const getProfessionalReviews = asyncHandler(async (req, res) => {
  const reviews = professionalService.getReviews(req.params.id);
  return successResponse(res, 200, 'Professional reviews fetched', reviews);
});

// GET /api/professionals/:id/availability
const getProfessionalAvailability = asyncHandler(async (req, res) => {
  const availability = professionalService.getAvailability(req.params.id);
  return successResponse(
    res,
    200,
    'Professional availability fetched',
    availability
  );
});

// PATCH /api/professionals/:id/availability
const updateAvailability = asyncHandler(async (req, res) => {
  const professional = professionalService.updateAvailability(
    req.params.id,
    req.body.availableNow
  );
  return successResponse(res, 200, 'Availability updated', professional);
});

// PATCH /api/professionals/:id/rate
const updateRate = asyncHandler(async (req, res) => {
  const professional = professionalService.updateRate(
    req.params.id,
    req.body.perMinuteRate
  );
  return successResponse(res, 200, 'Per-minute rate updated', professional);
});

module.exports = {
  listProfessionals,
  searchProfessionals,
  getProfessional,
  getProfessionalReviews,
  getProfessionalAvailability,
  updateAvailability,
  updateRate,
};
