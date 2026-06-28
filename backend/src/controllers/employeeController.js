// employeeController — HTTP surface for /api/employee/*. Thin wrappers
// around employeeService. Auth + state machine live in the service.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const employeeService = require('../services/employeeService');
const employeeDashboardService = require('../services/employeeDashboardService');

// POST /api/employee/signup
// Body: { name, email, phone, termsAccepted }
const signup = asyncHandler(async (req, res) => {
  const out = await employeeService.startSignup(req.body || {});
  return successResponse(res, 201, 'OTP sent to your phone.', out);
});

// POST /api/employee/signup/resend-otp { phone }
const resendSignupOtp = asyncHandler(async (req, res) => {
  const out = await employeeService.resendSignupOtp(req.body || {});
  return successResponse(res, 200, 'OTP resent.', out);
});

// POST /api/employee/signup/verify-otp { phone, code, password? }
const verifySignupOtp = asyncHandler(async (req, res) => {
  const out = await employeeService.verifySignupOtp(req.body || {});
  return successResponse(res, 200, 'Employee verified.', out);
});

// POST /api/employee/login { identifier, password }
const loginWithPassword = asyncHandler(async (req, res) => {
  const out = await employeeService.loginWithPassword(req.body || {});
  return successResponse(res, 200, 'Logged in.', out);
});

// POST /api/employee/login/otp/send { phone }
const sendLoginOtp = asyncHandler(async (req, res) => {
  const out = await employeeService.sendLoginOtp(req.body || {});
  return successResponse(res, 200, 'Login OTP sent.', out);
});

// POST /api/employee/login/otp/verify { phone, code }
const loginWithOtp = asyncHandler(async (req, res) => {
  const out = await employeeService.loginWithOtp(req.body || {});
  return successResponse(res, 200, 'Logged in.', out);
});

// GET /api/employee/me  — current employee profile.
const getMe = asyncHandler(async (req, res) => {
  const me = await employeeService.getMe(req.employee.id);
  return successResponse(res, 200, 'Employee fetched.', me);
});

// --- Dashboard ---------------------------------------------------------

const getSummary = asyncHandler(async (req, res) => {
  const data = await employeeDashboardService.getSummary(req.employee.id);
  return successResponse(res, 200, 'Summary fetched.', data);
});

const listOnboardedProfessionals = asyncHandler(async (req, res) => {
  const list = await employeeDashboardService.listOnboardedProfessionals(
    req.employee.id
  );
  return successResponse(res, 200, 'Onboarded professionals.', list);
});

const listCommissions = asyncHandler(async (req, res) => {
  const list = await employeeDashboardService.listCommissions(
    req.employee.id
  );
  return successResponse(res, 200, 'Commissions.', list);
});

const listPayouts = asyncHandler(async (req, res) => {
  const list = await employeeDashboardService.listPayouts(req.employee.id);
  return successResponse(res, 200, 'Payouts.', list);
});

const requestPayout = asyncHandler(async (req, res) => {
  const row = await employeeDashboardService.requestPayout(
    req.employee.id,
    req.body || {}
  );
  return successResponse(res, 201, 'Payout requested.', row);
});

const cancelPayout = asyncHandler(async (req, res) => {
  const row = await employeeDashboardService.cancelPayout(
    req.employee.id,
    req.params.id
  );
  return successResponse(res, 200, 'Payout cancelled.', row);
});

// --- Onboard a professional via the employee surface -------------------

const onboardProfessional = asyncHandler(async (req, res) => {
  const out = await employeeDashboardService.onboardProfessional(
    req.employee,
    req.body || {}
  );
  return successResponse(res, 201, 'Professional submitted for approval.', out);
});

module.exports = {
  signup,
  resendSignupOtp,
  verifySignupOtp,
  loginWithPassword,
  sendLoginOtp,
  loginWithOtp,
  getMe,
  getSummary,
  listOnboardedProfessionals,
  listCommissions,
  listPayouts,
  requestPayout,
  cancelPayout,
  onboardProfessional,
};
