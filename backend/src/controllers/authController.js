const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = authService.login(email, password);
  return successResponse(res, 200, 'Login successful', result);
});

// POST /api/auth/register-client
const registerClient = asyncHandler(async (req, res) => {
  const result = authService.registerClient(req.body);
  return successResponse(res, 201, 'Client registered successfully', result);
});

// POST /api/auth/register-professional
const registerProfessional = asyncHandler(async (req, res) => {
  const result = authService.registerProfessional(req.body);
  return successResponse(
    res,
    201,
    'Professional registered successfully (pending admin approval)',
    result
  );
});

// POST /api/auth/register-firm
const registerFirm = asyncHandler(async (req, res) => {
  const result = authService.registerFirm(req.body);
  return successResponse(res, 201, 'Firm registered successfully', result);
});

// GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  const user = authService.getCurrentUser(req.user.id);
  return successResponse(res, 200, 'Current user fetched', user);
});

module.exports = {
  login,
  registerClient,
  registerProfessional,
  registerFirm,
  getMe,
};
