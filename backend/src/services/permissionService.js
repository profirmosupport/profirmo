// permissionService — read side of the F3 RBAC. Given a User id, find
// their effective firm role (FirmMember.role on the firm they belong
// to) and answer "can this user perform <action>?".
//
// Resolution order:
//   1. If the user's top-level User.role is 'admin' → all actions.
//   2. If they have an active FirmMember row with a recognised role
//      → that role's matrix.
//   3. If they're a solo professional with no FirmMember → treat as
//      PARTNER of their own one-person firm (so the existing
//      single-pro UX doesn't regress).
//   4. Clients have no firm role and never go through this gate —
//      their access is enforced inline in each controller (the case /
//      booking ownership checks we already have).
//
// Cached per-request via res.locals — the middleware sets it once so
// downstream handlers don't re-query.

const { FirmMember, ProfessionalDetail, User } = require('../models');
const {
  FIRM_ROLES,
  ALL_FIRM_ROLES,
  ACTIONS,
  roleHas,
  actionsFor,
} = require('../config/permissions');

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

function isAdmin(user) {
  if (!user) return false;
  return ADMIN_ROLES.has(String(user.role || '').toLowerCase());
}

/**
 * Return the effective firm role for a user — null if not a firm pro
 * (e.g. client, solo pro without FirmMember, unauthenticated request).
 * `solo` flag indicates the caller is a professional but not on any
 * firm; callers can treat that as PARTNER if they want full power on
 * their own data.
 */
async function getEffectiveFirmRole(user) {
  if (!user || !user.id) return { role: null, solo: false };
  if (isAdmin(user)) return { role: 'admin', solo: false };

  // Resolve user → ProfessionalDetail → FirmMember row.
  const detail = await ProfessionalDetail.findOne({
    where: { userId: user.id },
    attributes: ['id'],
    raw: true,
  });
  if (!detail) return { role: null, solo: false };

  const member = await FirmMember.findOne({
    where: { professionalId: detail.id, status: 'active' },
    attributes: ['role'],
    raw: true,
  });
  if (!member) {
    // Solo professional — own everything in their own data.
    return { role: FIRM_ROLES.PARTNER, solo: true };
  }

  const normalised = String(member.role || '').toLowerCase().trim();
  if (!ALL_FIRM_ROLES.includes(normalised)) {
    // Legacy / free-form role string — treat as PARTNER by default so
    // existing teams don't lose access overnight. Migrating these to
    // the canonical role names is part of the firm-admin UX.
    return { role: FIRM_ROLES.PARTNER, solo: false, legacyRole: normalised || null };
  }
  return { role: normalised, solo: false };
}

/**
 * Returns true if `user` is allowed to perform `action`. Admins
 * short-circuit to true. Unknown roles → false (deny by default).
 */
async function userCan(user, action) {
  if (isAdmin(user)) return true;
  const { role } = await getEffectiveFirmRole(user);
  if (!role) return false;
  if (role === 'admin') return true;
  return roleHas(role, action);
}

/** Convenience for the /api/users/me payload. */
async function describeForUser(user) {
  if (!user) return { role: null, actions: [], admin: false };
  if (isAdmin(user)) {
    return {
      role: 'admin',
      actions: Object.values(ACTIONS),
      admin: true,
      solo: false,
    };
  }
  const { role, solo, legacyRole } = await getEffectiveFirmRole(user);
  return {
    role,
    actions: role ? actionsFor(role) : [],
    admin: false,
    solo: !!solo,
    legacyRole: legacyRole || null,
  };
}

module.exports = {
  getEffectiveFirmRole,
  userCan,
  describeForUser,
  isAdmin,
  ACTIONS,
};
