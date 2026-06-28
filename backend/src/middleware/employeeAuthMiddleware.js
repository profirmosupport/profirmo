// employeeAuthMiddleware — separate guard for the /api/employee/*
// surface. Verifies a JWT signed by employeeService.signEmployeeToken
// and loads the live Employee row onto req.employee so handlers can
// authorise without re-querying.
//
// Why a separate middleware? The User-facing authenticate() loads a
// User row from the `users` table; employees live in `employees` and
// are not Users. Sharing one guard would either need a polymorphic
// loader or a flag — cleaner to keep them apart.

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const employeeService = require('../services/employeeService');

async function authenticateEmployee(req, res, next) {
  const header = req.headers && req.headers.authorization;
  const bearer =
    header && header.toLowerCase().startsWith('bearer ')
      ? header.slice(7).trim()
      : '';
  if (!bearer) {
    return res
      .status(401)
      .json({ success: false, message: 'Authentication required.' });
  }
  let decoded;
  try {
    decoded = jwt.verify(bearer, env.jwtSecret);
  } catch {
    return res
      .status(401)
      .json({ success: false, message: 'Invalid or expired session.' });
  }
  // Reject any token that isn't an employee-access token — e.g. a
  // User access token can't authenticate an employee endpoint.
  if (decoded.role !== 'employee' || decoded.type !== 'employee-access') {
    return res
      .status(403)
      .json({ success: false, message: 'Employee session required.' });
  }
  const employee = await employeeService.getActiveById(decoded.sub);
  if (!employee) {
    return res
      .status(403)
      .json({ success: false, message: 'Employee account is not active.' });
  }
  req.employee = employee;
  return next();
}

module.exports = { authenticateEmployee };
