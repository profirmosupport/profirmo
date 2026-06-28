// permissions — placeholder role-permission matrix for the F3 RBAC pass.
// Each firm member has a role (stored on FirmMember.role) drawn from
// FIRM_ROLES below. Each role maps to a set of named actions. Action
// names are dot-separated `resource.verb` so a controller can ask
// `requirePermission('case.delete')` without knowing the matrix shape.
//
// IMPORTANT: this is a placeholder. The real matrix should be filled
// in by the firm's owner after consulting with their actual team
// structure. Keys without an entry default to "deny" — so adding a new
// action automatically locks out everyone except `partner` until a
// permission line is added.

const FIRM_ROLES = {
  PARTNER: 'partner',
  ASSOCIATE: 'associate',
  PARALEGAL: 'paralegal',
  INTERN: 'intern',
  ACCOUNTANT: 'accountant',
};

const ALL_FIRM_ROLES = Object.values(FIRM_ROLES);

// Named actions across the product. Group by resource + verb so a
// reviewer can scan one column. Add the new action to MATRIX below at
// the same time — un-listed actions are denied by default.
const ACTIONS = {
  // Case lifecycle
  CASE_READ: 'case.read',
  CASE_CREATE: 'case.create',
  CASE_UPDATE: 'case.update',
  CASE_DELETE: 'case.delete',

  // Case-internal artefacts (notes, updates, attachments, tasks).
  // Paralegals work here daily.
  CASE_INTERNAL_READ: 'case.internal.read',
  CASE_INTERNAL_WRITE: 'case.internal.write',

  // Bookings (consultations).
  BOOKING_READ: 'booking.read',
  BOOKING_UPDATE: 'booking.update',
  BOOKING_DELETE: 'booking.delete',

  // Financial — payments, payouts, invoices, trust ledger.
  FINANCE_READ: 'finance.read',
  FINANCE_WRITE: 'finance.write',
  FINANCE_EXPORT: 'finance.export',

  // Audit log.
  AUDIT_READ: 'audit.read',
};

// Placeholder matrix per the user's brief:
//   * partner       — everything
//   * associate     — everything EXCEPT destructive deletes
//   * paralegal     — case-internal only (notes, updates, tasks, attachments)
//   * intern        — read-only everywhere they're already on the case
//   * accountant    — financial-only (read + write + export)
const MATRIX = {
  [FIRM_ROLES.PARTNER]: new Set([
    ACTIONS.CASE_READ,
    ACTIONS.CASE_CREATE,
    ACTIONS.CASE_UPDATE,
    ACTIONS.CASE_DELETE,
    ACTIONS.CASE_INTERNAL_READ,
    ACTIONS.CASE_INTERNAL_WRITE,
    ACTIONS.BOOKING_READ,
    ACTIONS.BOOKING_UPDATE,
    ACTIONS.BOOKING_DELETE,
    ACTIONS.FINANCE_READ,
    ACTIONS.FINANCE_WRITE,
    ACTIONS.FINANCE_EXPORT,
    ACTIONS.AUDIT_READ,
  ]),
  [FIRM_ROLES.ASSOCIATE]: new Set([
    ACTIONS.CASE_READ,
    ACTIONS.CASE_CREATE,
    ACTIONS.CASE_UPDATE,
    // no CASE_DELETE — associates can edit but not delete
    ACTIONS.CASE_INTERNAL_READ,
    ACTIONS.CASE_INTERNAL_WRITE,
    ACTIONS.BOOKING_READ,
    ACTIONS.BOOKING_UPDATE,
    // no BOOKING_DELETE
    ACTIONS.FINANCE_READ,
    // no FINANCE_WRITE / EXPORT
    ACTIONS.AUDIT_READ,
  ]),
  [FIRM_ROLES.PARALEGAL]: new Set([
    ACTIONS.CASE_READ,
    ACTIONS.CASE_INTERNAL_READ,
    ACTIONS.CASE_INTERNAL_WRITE,
    ACTIONS.BOOKING_READ,
    // can advance a booking's status (note: case-internal-only excludes
    // financial side-effects which live on the payment, not booking row)
    ACTIONS.BOOKING_UPDATE,
  ]),
  [FIRM_ROLES.INTERN]: new Set([
    ACTIONS.CASE_READ,
    ACTIONS.CASE_INTERNAL_READ,
    ACTIONS.BOOKING_READ,
  ]),
  [FIRM_ROLES.ACCOUNTANT]: new Set([
    // No case access — accountants don't need legal-content visibility.
    ACTIONS.BOOKING_READ,
    ACTIONS.FINANCE_READ,
    ACTIONS.FINANCE_WRITE,
    ACTIONS.FINANCE_EXPORT,
  ]),
};

/**
 * Return true if the given firm role can perform `action`.
 * Unknown role → deny.
 */
function roleHas(firmRole, action) {
  if (!firmRole) return false;
  const set = MATRIX[firmRole];
  return !!(set && set.has(action));
}

/** Return the full set of action strings for a role. */
function actionsFor(firmRole) {
  const set = MATRIX[firmRole];
  return set ? Array.from(set) : [];
}

module.exports = {
  FIRM_ROLES,
  ALL_FIRM_ROLES,
  ACTIONS,
  MATRIX,
  roleHas,
  actionsFor,
};
