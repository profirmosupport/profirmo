const adminService = require('../services/adminService');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');

// GET /api/admin/stats
const getStats = asyncHandler(async (req, res) => {
  const stats = adminService.getStats();
  return successResponse(res, 200, 'Platform statistics fetched', stats);
});

// GET /api/admin/users
const listUsers = asyncHandler(async (req, res) => {
  const users = adminService.listUsers();
  return successResponse(res, 200, 'Users fetched', users);
});

// GET /api/admin/professionals/pending
const getPendingProfessionals = asyncHandler(async (req, res) => {
  const pending = adminService.getPendingProfessionals();
  return successResponse(res, 200, 'Pending professionals fetched', pending);
});

// PATCH /api/admin/professionals/:id/approve
const approveProfessional = asyncHandler(async (req, res) => {
  const professional = adminService.approveProfessional(req.params.id);
  return successResponse(res, 200, 'Professional approved', professional);
});

// GET /api/admin/firms
const listFirms = asyncHandler(async (req, res) => {
  const firms = adminService.listFirms();
  return successResponse(res, 200, 'Firms fetched', firms);
});

// GET /api/admin/bookings
const listBookings = asyncHandler(async (req, res) => {
  const bookings = adminService.listBookings();
  return successResponse(res, 200, 'Bookings fetched', bookings);
});

module.exports = {
  getStats,
  listUsers,
  getPendingProfessionals,
  approveProfessional,
  listFirms,
  listBookings,
};
