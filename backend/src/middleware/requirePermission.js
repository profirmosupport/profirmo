// requirePermission — Express middleware factory. Use after
// `authenticate` to gate an endpoint on a specific RBAC action:
//
//   router.delete(
//     '/cases/:id',
//     authenticate,
//     requirePermission('case.delete'),
//     caseController.deleteCase
//   );
//
// Behaviour:
//   * No req.user → 401 (defensive — caller should authenticate first).
//   * Admin role → pass.
//   * Action present in the user's role matrix → pass.
//   * Otherwise → 403 with the action name in the message.

const permissionService = require('../services/permissionService');

function requirePermission(action) {
  if (!action) {
    throw new Error('requirePermission(action) — action string is required');
  }
  return async function permissionMiddleware(req, res, next) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          errors: null,
        });
      }
      const allowed = await permissionService.userCan(req.user, action);
      if (allowed) return next();

      return res.status(403).json({
        success: false,
        message: `You do not have permission to perform this action (${action}).`,
        errors: null,
        code: 'PERMISSION_DENIED',
        action,
      });
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = requirePermission;
