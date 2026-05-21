const { errorResponse } = require('../utils/responseHandler');

/**
 * Role-based authorization guard. Must run after `authenticate`.
 * @param {...string} allowedRoles - roles permitted to access the route
 * @returns {function} Express middleware
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return errorResponse(res, 401, 'Authentication required');
    }
    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(
        res,
        403,
        `Access denied: requires role(s) ${allowedRoles.join(', ')}`
      );
    }
    return next();
  };
};

module.exports = { authorize };
