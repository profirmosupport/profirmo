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
//   * Otherwise → 403 with the action name in the message + an audit
//     row recording the denied attempt (helpful for "who tried to
//     delete a case last week?" investigations).

const permissionService = require('../services/permissionService');
const auditService = require('../services/auditService');

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

      // Record the denial — small audit row so we have a trail of
      // attempted privilege escalations. Fire-and-forget per the
      // auditService failure model.
      auditService.record({
        req,
        entityType: 'permission',
        entityId: action,
        action: 'access_denied',
        summary: `Denied: ${req.method} ${req.originalUrl} (action=${action})`,
      });

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
