const bookingService = require('../services/bookingService');
const asyncHandler = require('../utils/asyncHandler');
const {
  successResponse,
  paginatedResponse,
} = require('../utils/responseHandler');

// GET /api/bookings
const listBookings = asyncHandler(async (req, res) => {
  const { page, limit, ...filters } = req.query;
  const { items, ...meta } = bookingService.list({ filters, page, limit });
  return paginatedResponse(res, 'Bookings fetched', items, meta);
});

// GET /api/bookings/:id
const getBooking = asyncHandler(async (req, res) => {
  const booking = bookingService.getById(req.params.id);
  return successResponse(res, 200, 'Booking fetched', booking);
});

// POST /api/bookings
const createBooking = asyncHandler(async (req, res) => {
  const booking = bookingService.create(req.body);
  return successResponse(res, 201, 'Booking created', booking);
});

// PATCH /api/bookings/:id/status
const updateBookingStatus = asyncHandler(async (req, res) => {
  const booking = bookingService.updateStatus(
    req.params.id,
    req.body.status
  );
  return successResponse(res, 200, 'Booking status updated', booking);
});

// GET /api/bookings/client/:clientId
const getBookingsByClient = asyncHandler(async (req, res) => {
  const bookings = bookingService.getByClient(req.params.clientId);
  return successResponse(res, 200, 'Client bookings fetched', bookings);
});

// GET /api/bookings/professional/:professionalId
const getBookingsByProfessional = asyncHandler(async (req, res) => {
  const bookings = bookingService.getByProfessional(
    req.params.professionalId
  );
  return successResponse(res, 200, 'Professional bookings fetched', bookings);
});

module.exports = {
  listBookings,
  getBooking,
  createBooking,
  updateBookingStatus,
  getBookingsByClient,
  getBookingsByProfessional,
};
