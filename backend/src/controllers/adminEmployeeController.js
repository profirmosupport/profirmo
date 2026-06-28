// Admin-side HTTP surface for the Employee module. Mounted under
// /api/admin/employees/* and /api/admin/employee-payouts/* +
// /api/admin/employee-settings via adminRoutes.js.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const svc = require('../services/employeeAdminService');

// GET /api/admin/employees?q=&status=
const list = asyncHandler(async (req, res) => {
  const data = await svc.listEmployees({
    q: req.query.q,
    status: req.query.status,
  });
  return successResponse(res, 200, 'Employees listed.', data);
});

// GET /api/admin/employees/:id
const get = asyncHandler(async (req, res) => {
  const data = await svc.getEmployee(req.params.id);
  return successResponse(res, 200, 'Employee fetched.', data);
});

// GET /api/admin/employees/:id/professionals
const getProfessionals = asyncHandler(async (req, res) => {
  const data = await svc.listEmployeeProfessionals(req.params.id);
  return successResponse(res, 200, 'Onboarded professionals.', data);
});

// POST /api/admin/employees — create an employee from the admin panel.
const create = asyncHandler(async (req, res) => {
  const data = await svc.createEmployee(
    req.body || {},
    req.user && req.user.id
  );
  return successResponse(res, 201, 'Employee created.', data);
});

// PATCH /api/admin/employees/:id  — partial update.
const update = asyncHandler(async (req, res) => {
  const data = await svc.updateEmployee(req.params.id, req.body || {});
  return successResponse(res, 200, 'Employee updated.', data);
});

// DELETE /api/admin/employees/:id — refuses when audit history exists.
const remove = asyncHandler(async (req, res) => {
  const data = await svc.deleteEmployee(req.params.id);
  return successResponse(res, 200, 'Employee deleted.', data);
});

// GET /api/admin/employee-payouts?status=
const listPayouts = asyncHandler(async (req, res) => {
  const data = await svc.listAllPayouts({ status: req.query.status });
  return successResponse(res, 200, 'Payouts listed.', data);
});

// PATCH /api/admin/employee-payouts/:id
const decidePayout = asyncHandler(async (req, res) => {
  const data = await svc.decidePayout(
    req.params.id,
    req.user && req.user.id,
    req.body || {}
  );
  return successResponse(res, 200, 'Payout updated.', data);
});

// GET /api/admin/employee-settings
const readSettings = asyncHandler(async (req, res) => {
  const data = await svc.readSettings();
  return successResponse(res, 200, 'Settings fetched.', data);
});

// PUT /api/admin/employee-settings
const writeSettings = asyncHandler(async (req, res) => {
  const data = await svc.writeSettings(
    req.body || {},
    req.user && req.user.id
  );
  return successResponse(res, 200, 'Settings saved.', data);
});

module.exports = {
  list,
  get,
  getProfessionals,
  create,
  update,
  remove,
  listPayouts,
  decidePayout,
  readSettings,
  writeSettings,
};
