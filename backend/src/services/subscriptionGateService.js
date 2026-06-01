// subscriptionGateService — read-time enforcement of plan limits.
//
// Other services call these methods BEFORE creating cases / firms / firm
// members so the user gets an immediate 403 instead of silently exceeding
// the limit they paid for. Every gate returns a structured result the
// controller layer can either throw with or surface as a friendly error
// with an upgrade CTA on the frontend.
//
// Caching: each gate fetches the user's active subscription + plan + the
// current usage count for the limit it cares about. That's three DB
// reads per gate check, which is fine on the typical create-N-times path.
// If we ever hot-loop these checks we can memoise per request.

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const {
  ProfessionalSubscription,
  SubscriptionPlan,
  Case,
  LawFirm,
  FirmMember,
  User,
} = require('../models');

// Case categorisation by assignee count:
//   * Single-assignee (or null assignees array) -> "individual" case,
//     counts against the user's personal caseLimit.
//   * 2+ assignees                              -> "firm" case, counts
//     against the firm's firmCaseLimit.
// professionalIds is a JSON column; COALESCE handles legacy rows where it
// might be NULL.
const SINGLE_ASSIGNEE = sequelize.literal(
  'COALESCE(JSON_LENGTH(`professionalIds`), 1) <= 1'
);
const MULTI_ASSIGNEE = sequelize.literal(
  'COALESCE(JSON_LENGTH(`professionalIds`), 1) >= 2'
);

/**
 * Build a structured `{allowed, code, message, …}` failure that endpoints
 * can directly turn into an HTTP 403 with code='PLAN_LIMIT_REACHED'. The
 * frontend keys off `code` to render an upgrade-plan CTA.
 */
function deny({ message, limit = null, currentCount = null, feature = '', planName = '' }) {
  return {
    allowed: false,
    code: 'PLAN_LIMIT_REACHED',
    feature,
    planName,
    limit,
    currentCount,
    message,
  };
}

function allow({ extra = {} } = {}) {
  return { allowed: true, ...extra };
}

/**
 * Look up the user's active subscription + plan row, plus their legacy
 * professional id (`linkedId`) — required because Case / FirmMember rows
 * key off the professional id, not the user id.
 *
 * Returns `null` when the user has no subscription on record — callers
 * fall open in that case so backfill misses don't block users mid-flow.
 */
async function loadContext(userId) {
  if (!userId) return null;
  const [sub, user] = await Promise.all([
    ProfessionalSubscription.findOne({
      where: { userId, status: 'active' },
      order: [['startDate', 'DESC']],
      raw: true,
    }),
    User.findByPk(userId, { raw: true, attributes: ['id', 'linkedId', 'role'] }),
  ]);
  if (!sub) return null;
  const plan = await SubscriptionPlan.findByPk(sub.subscriptionPlanId, {
    raw: true,
  });
  if (!plan) return null;
  return {
    subscription: sub,
    plan,
    user,
    professionalId: (user && user.linkedId) || null,
  };
}

// --- Case creation --------------------------------------------------------

/**
 * Internal — given a legacy professional id, find the user that owns it.
 * Used by canAssignCaseToProfessional so the gate works for case-create /
 * case-update flows where the CALLER may not be the assignee.
 */
async function userForProfessionalId(professionalId) {
  if (!professionalId) return null;
  return User.findOne({ where: { linkedId: professionalId }, raw: true });
}

/**
 * Can a single-assignee case be assigned to this professional?
 *
 * Looks up the assignee's plan (NOT the caller's) and counts their
 * current single-assignee cases. When `excludeCaseId` is supplied that
 * case is excluded from the count — used during reassignment so a pro
 * reassigning a case to themselves isn't double-counted.
 *
 * Returns allow() when:
 *   - professionalId is empty (no assignee to gate against),
 *   - the assignee has no subscription on file,
 *   - the plan grants unlimited cases.
 */
async function canAssignCaseToProfessional(professionalId, excludeCaseId = null) {
  if (!professionalId) return allow();
  const user = await userForProfessionalId(professionalId);
  if (!user) return allow();
  const ctx = await loadContext(user.id);
  if (!ctx) return allow();
  const { plan } = ctx;
  if (!plan.caseManagementEnabled) {
    return deny({
      message:
        `The selected professional's plan (${plan.name}) doesn't include case management.`,
      feature: 'case_management',
      planName: plan.name,
    });
  }
  if (plan.unlimitedCases) return allow();
  const cap = plan.caseLimit;
  if (cap === null || cap === undefined) return allow();

  const where = {
    professionalId,
    [Op.and]: [SINGLE_ASSIGNEE],
  };
  if (excludeCaseId) where.id = { [Op.ne]: excludeCaseId };
  const count = await Case.count({ where });

  if (count >= cap) {
    return deny({
      message: `The selected professional has reached their ${cap}-case limit on the ${plan.name}.`,
      feature: 'case_limit',
      planName: plan.name,
      limit: cap,
      currentCount: count,
    });
  }
  return allow({ extra: { currentCount: count, limit: cap } });
}

/**
 * Can this user create a new case (as an INDIVIDUAL case — single
 * assignee)? Counts all cases this user owns as the sole assignee,
 * regardless of status (closed cases are counted per the product spec).
 *
 * Multi-pro cases are categorised as firm cases — see canCreateFirmCase.
 */
async function canCreateCase(userId) {
  const ctx = await loadContext(userId);
  if (!ctx) return allow(); // Fail-open when no subscription on file.
  const { plan } = ctx;
  if (!plan.caseManagementEnabled) {
    return deny({
      message:
        'Case management is not available on your current plan. Upgrade to start tracking cases.',
      feature: 'case_management',
      planName: plan.name,
    });
  }
  if (plan.unlimitedCases) return allow();
  const cap = plan.caseLimit;
  if (cap === null || cap === undefined) return allow();

  // Cases store `professionalId` = the user's legacy professional id
  // (User.linkedId), not the user id directly. Fall open when the user
  // hasn't been backfilled with a linkedId yet.
  if (!ctx.professionalId) return allow();
  const ownerCount = await Case.count({
    where: {
      professionalId: ctx.professionalId,
      [Op.and]: [SINGLE_ASSIGNEE],
    },
  });

  if (ownerCount >= cap) {
    return deny({
      message: `You've reached the ${cap}-case limit on the ${plan.name}. Upgrade to manage more cases.`,
      feature: 'case_limit',
      planName: plan.name,
      limit: cap,
      currentCount: ownerCount,
    });
  }
  return allow({ extra: { currentCount: ownerCount, limit: cap } });
}

// --- Firm creation --------------------------------------------------------

/**
 * Can this user create a new firm?
 *   - firmCreationAllowed must be true
 *   - if not unlimited, the count of law_firms they OWN (createdByUserId
 *     === this user, or where the user is on the FirmMember roster with
 *     role='OWNER') must be below firmLimit.
 */
async function canCreateFirm(userId) {
  const ctx = await loadContext(userId);
  if (!ctx) return allow();
  const { plan } = ctx;
  if (!plan.firmCreationAllowed) {
    return deny({
      message:
        'Firm creation is not available on your current plan. Upgrade to set up a firm.',
      feature: 'firm_creation',
      planName: plan.name,
    });
  }
  if (plan.unlimitedFirms) return allow();
  const cap = plan.firmLimit;
  if (cap === null || cap === undefined) return allow();

  // "Firms owned by this user" — count FirmMember rows for the user's
  // legacy professional id with an owner-class role. ALSO count law_firms
  // whose ownerUserId points at this user directly (covers freshly-
  // created firms before the FirmMember roster is written).
  const proId = ctx.professionalId;
  const [memberCount, lawFirmCount] = await Promise.all([
    proId
      ? FirmMember.count({
          where: {
            professionalId: proId,
            role: { [Op.in]: ['OWNER', 'ADMIN', 'owner', 'admin'] },
          },
        })
      : 0,
    LawFirm.count({ where: { ownerUserId: userId } }),
  ]);
  const ownerMemberships = Math.max(memberCount, lawFirmCount);

  if (ownerMemberships >= cap) {
    return deny({
      message: `You've reached the ${cap}-firm limit on the ${plan.name}. Upgrade to create more firms.`,
      feature: 'firm_limit',
      planName: plan.name,
      limit: cap,
      currentCount: ownerMemberships,
    });
  }
  return allow({ extra: { currentCount: ownerMemberships, limit: cap } });
}

/**
 * Count cases that count against this firm's case quota.
 *
 * A "firm case" per the product spec is any case with 2+ assigned
 * professionals where at least one of those assignees is a member of the
 * firm. The case row itself may not have firmId set (the form doesn't
 * always populate it for shared cases), so we fall back to matching by
 * the FirmMember roster.
 *
 * Two paths get unioned:
 *   1. Case.firmId = firmId   (explicit link)
 *   2. professionalIds JSON column contains ANY of the firm's member
 *      professional ids
 *
 * Closed cases ARE counted. Implemented with a raw query because Sequelize
 * doesn't have a clean way to express "JSON_CONTAINS one of N values"
 * portably.
 */
async function countFirmCases(firmId, excludeCaseId = null) {
  if (!firmId) return 0;
  const memberPros = (
    await FirmMember.findAll({
      where: { firmId, status: { [Op.ne]: 'inactive' } },
      raw: true,
      attributes: ['professionalId'],
    })
  )
    .map((m) => m.professionalId)
    .filter(Boolean);

  // Build a `JSON_CONTAINS(professionalIds, JSON_QUOTE(:pro0)) OR …` chain.
  const replacements = { firmId };
  const containsClauses = [];
  memberPros.forEach((p, i) => {
    const key = `pro${i}`;
    replacements[key] = p;
    containsClauses.push(
      `JSON_CONTAINS(\`professionalIds\`, JSON_QUOTE(:${key}))`
    );
  });
  const memberOrSql =
    containsClauses.length > 0 ? `OR (${containsClauses.join(' OR ')})` : '';

  let excludeSql = '';
  if (excludeCaseId) {
    replacements.excludeCaseId = excludeCaseId;
    excludeSql = 'AND id <> :excludeCaseId';
  }

  const [rows] = await sequelize.query(
    `SELECT COUNT(DISTINCT id) AS n FROM cases
     WHERE COALESCE(JSON_LENGTH(\`professionalIds\`), 1) >= 2
       AND (\`firmId\` = :firmId ${memberOrSql})
       ${excludeSql}`,
    { replacements }
  );
  return Number(rows[0] && rows[0].n) || 0;
}

// --- Firm-level case creation --------------------------------------------

/**
 * Resolve the firm owner's userId from a firmId. Tries the dedicated FK
 * first, falls back to FirmMember rows with role=OWNER/ADMIN.
 */
async function resolveFirmOwnerId(firmId) {
  if (!firmId) return null;
  const firm = await LawFirm.findByPk(firmId, { raw: true });
  if (!firm) return null;
  // Primary: LawFirm.ownerUserId is the user id of the firm's creator.
  let ownerId = firm.ownerUserId || null;
  // Fallback: look up the owner-class FirmMember row, then map the legacy
  // professional id back to a User via linkedId.
  if (!ownerId) {
    const ownerRow = await FirmMember.findOne({
      where: {
        firmId,
        role: { [Op.in]: ['OWNER', 'ADMIN', 'owner', 'admin'] },
      },
      order: [['createdAt', 'ASC']],
      raw: true,
    });
    if (ownerRow && ownerRow.professionalId) {
      const linkedUser = await User.findOne({
        where: { linkedId: ownerRow.professionalId },
        raw: true,
        attributes: ['id'],
      });
      ownerId = linkedUser && linkedUser.id;
    }
  }
  return ownerId;
}

/**
 * Can a new case be created UNDER A FIRM? Reads the firm OWNER's plan
 * (not the caller's). A "firm case" is any case linked to this firm with
 * 2+ assignees (per spec: multi-pro cases count as firm cases). Closed
 * cases are counted.
 */
async function canCreateFirmCase(firmId, excludeCaseId = null) {
  if (!firmId) return allow();
  const ownerId = await resolveFirmOwnerId(firmId);
  if (!ownerId) return allow();
  const ctx = await loadContext(ownerId);
  if (!ctx) return allow();
  const { plan } = ctx;
  if (plan.unlimitedFirmCases) return allow();
  const cap = plan.firmCaseLimit;
  if (cap === null || cap === undefined) return allow();
  const count = await countFirmCases(firmId, excludeCaseId);
  if (count >= cap) {
    return deny({
      message: `This firm has reached its ${cap}-case limit on the ${plan.name}. The firm owner needs to upgrade to add more cases.`,
      feature: 'firm_case_limit',
      planName: plan.name,
      limit: cap,
      currentCount: count,
    });
  }
  return allow({ extra: { currentCount: count, limit: cap } });
}

// --- Firm member addition -------------------------------------------------

/**
 * Can a new professional be added to this firm?
 *
 * The relevant plan limit lives on the FIRM OWNER's subscription. We find
 * the owner by reading the firm row's createdByUserId (or falling back to
 * the OWNER role in FirmMember), then run the per-plan
 * `professionalsAllowed` check against the current member count.
 */
async function canAddFirmMember(firmId) {
  if (!firmId) return allow();
  const firm = await LawFirm.findByPk(firmId, { raw: true });
  if (!firm) return allow();

  // Resolve firm owner — try the dedicated FK first, fall back to roster.
  let ownerId = firm.createdByUserId || firm.ownerId || null;
  if (!ownerId) {
    const ownerRow = await FirmMember.findOne({
      where: {
        firmId,
        role: { [Op.in]: ['OWNER', 'ADMIN', 'owner', 'admin'] },
      },
      order: [['createdAt', 'ASC']],
      raw: true,
    });
    ownerId = ownerRow && ownerRow.userId;
  }
  if (!ownerId) return allow();

  const ctx = await loadContext(ownerId);
  if (!ctx) return allow();
  const { plan } = ctx;
  if (!plan.unlimitedProfessionals) {
    const cap = plan.professionalsAllowed;
    if (cap !== null && cap !== undefined) {
      // Exclude the firm owner from the count — quotas apply to
      // additional professionals only, not the owner themselves.
      const currentCount = await FirmMember.count({
        where: {
          firmId,
          status: { [Op.ne]: 'inactive' },
          role: { [Op.notIn]: ['owner', 'OWNER'] },
        },
      });
      if (currentCount >= cap) {
        return deny({
          message: `This firm has reached its ${cap}-professional limit on the ${plan.name}. The firm owner needs to upgrade to add more team members.`,
          feature: 'firm_professional_limit',
          planName: plan.name,
          limit: cap,
          currentCount,
        });
      }
    }
  }
  return allow();
}

/**
 * Convenience wrapper that throws a tagged error suitable for the
 * `asyncHandler` -> errorHandler middleware chain. Use in controllers:
 *
 *     await gates.enforceCanCreateCase(req.user.id);
 *     // …continue with create…
 */
async function enforceCanCreateCase(userId) {
  const r = await canCreateCase(userId);
  if (!r.allowed) throw planLimitError(r);
}
async function enforceCanAssignCaseToProfessional(professionalId, excludeCaseId = null) {
  const r = await canAssignCaseToProfessional(professionalId, excludeCaseId);
  if (!r.allowed) throw planLimitError(r);
}
async function enforceCanCreateFirmCase(firmId, excludeCaseId = null) {
  const r = await canCreateFirmCase(firmId, excludeCaseId);
  if (!r.allowed) throw planLimitError(r);
}
async function enforceCanCreateFirm(userId) {
  const r = await canCreateFirm(userId);
  if (!r.allowed) throw planLimitError(r);
}
async function enforceCanAddFirmMember(firmId) {
  const r = await canAddFirmMember(firmId);
  if (!r.allowed) throw planLimitError(r);
}

function planLimitError(result) {
  return {
    statusCode: 403,
    message: result.message,
    code: result.code,
    feature: result.feature,
    planName: result.planName,
    limit: result.limit,
    currentCount: result.currentCount,
  };
}

module.exports = {
  loadContext,
  resolveFirmOwnerId,
  countFirmCases,
  canCreateCase,
  canCreateFirmCase,
  canCreateFirm,
  canAddFirmMember,
  canAssignCaseToProfessional,
  enforceCanCreateCase,
  enforceCanCreateFirmCase,
  enforceCanAssignCaseToProfessional,
  enforceCanCreateFirm,
  enforceCanAddFirmMember,
};
