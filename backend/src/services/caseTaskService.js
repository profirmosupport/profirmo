// caseTaskService — CRUD + reorder for case-scoped tasks. Every call is
// owner-scoped: the caller must be the case's primary professional, the
// case's client, or (later) a firm member with the case shared. Today
// we accept the first two; firm-member sharing lands with F3 (RBAC).

const { Op } = require('sequelize');
const {
  CaseTask,
  CaseUpdate,
  Case,
  ProfessionalDetail,
  User,
} = require('../models');

// Resolve caller's user → ProfessionalDetail.id once so we can match
// Case.professionalId / Case.professionalIds against it.
async function myProfessionalId(userId) {
  const detail = await ProfessionalDetail.findOne({
    where: { userId },
    attributes: ['id'],
    raw: true,
  });
  return detail ? detail.id : null;
}

/**
 * Throws 403 unless the caller is on the case (as pro or client).
 * Returns the case row (`raw`) so callers can read fields without a
 * second query.
 */
async function assertAccess(userId, caseId) {
  const c = await Case.findOne({ where: { id: caseId }, raw: true });
  if (!c) throw { statusCode: 404, message: 'Case not found' };

  if (c.clientId === userId) return c;
  if (Array.isArray(c.clientIds) && c.clientIds.includes(userId)) return c;

  const proId = await myProfessionalId(userId);
  if (proId) {
    if (c.professionalId === proId) return c;
    if (Array.isArray(c.professionalIds) && c.professionalIds.includes(proId)) {
      return c;
    }
  }
  throw {
    statusCode: 403,
    message: 'You do not have access to this case',
  };
}

/**
 * Validate an assignee — they must be either the case's client or one
 * of the case's professionals (or the caller themselves). Stops a
 * professional from assigning a task to a random user id.
 */
async function assertAssigneeAllowed(c, assigneeUserId) {
  if (!assigneeUserId) return;
  if (assigneeUserId === c.clientId) return;
  if (Array.isArray(c.clientIds) && c.clientIds.includes(assigneeUserId)) return;

  // Resolve the assignee's professional id (if any) and compare.
  const detail = await ProfessionalDetail.findOne({
    where: { userId: assigneeUserId },
    attributes: ['id'],
    raw: true,
  });
  const proId = detail ? detail.id : null;
  if (proId) {
    if (c.professionalId === proId) return;
    if (Array.isArray(c.professionalIds) && c.professionalIds.includes(proId)) {
      return;
    }
  }
  throw {
    statusCode: 422,
    message: 'Assignee is not a participant on this case',
  };
}

function normalizeStatus(value) {
  const s = String(value || '').toLowerCase();
  if (!CaseTask.STATUSES.includes(s)) {
    throw {
      statusCode: 422,
      message: `status must be one of: ${CaseTask.STATUSES.join(', ')}`,
    };
  }
  return s;
}

function normalizePriority(value) {
  const s = String(value || 'normal').toLowerCase();
  if (!CaseTask.PRIORITIES.includes(s)) {
    throw {
      statusCode: 422,
      message: `priority must be one of: ${CaseTask.PRIORITIES.join(', ')}`,
    };
  }
  return s;
}

function normalizeDueDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw { statusCode: 422, message: 'dueDate must be YYYY-MM-DD' };
  }
  return s;
}

async function listForCase(userId, caseId) {
  await assertAccess(userId, caseId);
  const rows = await CaseTask.findAll({
    where: { caseId },
    order: [
      ['status', 'ASC'], // open/in_progress first because ENUM order matches
      ['position', 'ASC'],
      ['createdAt', 'ASC'],
    ],
    raw: true,
  });

  // Attach assignee display info in one trip — cheaper than N+1.
  const assigneeIds = [
    ...new Set(rows.map((r) => r.assigneeUserId).filter(Boolean)),
  ];
  if (assigneeIds.length === 0) return rows;
  const users = await User.findAll({
    where: { id: { [Op.in]: assigneeIds } },
    attributes: ['id', 'name', 'email'],
    raw: true,
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => ({
    ...r,
    assignee: r.assigneeUserId ? byId.get(r.assigneeUserId) || null : null,
  }));
}

/**
 * List task-shaped CaseUpdate rows the caller is responsible for
 * across all their cases — surfaces upcoming work on the dashboard
 * calendar. A row counts as a "task" when its `dueDate` is set and
 * status is open / in_progress (or unset). After the F1→Updates
 * refactor this reads from `case_updates`, not `case_tasks`, so the
 * dashboard calendar stays in sync with the single source of truth.
 */
async function listMineUpcoming(userId, window = {}) {
  const proId = await myProfessionalId(userId);

  // Cases where the caller is a participant.
  const caseRows = await Case.findAll({
    where: {
      [Op.or]: [
        { clientId: userId },
        ...(proId ? [{ professionalId: proId }] : []),
      ],
    },
    attributes: ['id', 'title', 'caseNumber'],
    raw: true,
  });
  const caseIds = caseRows.map((c) => c.id);
  if (caseIds.length === 0) return [];

  const where = {
    caseId: { [Op.in]: caseIds },
    dueDate: { [Op.ne]: null },
    [Op.or]: [
      { status: { [Op.in]: ['open', 'in_progress'] } },
      { status: null },
    ],
  };
  if (window.from || window.to) {
    where.dueDate = where.dueDate || {};
    if (window.from) where.dueDate[Op.gte] = window.from;
    if (window.to) where.dueDate[Op.lte] = window.to;
  }
  const rows = await CaseUpdate.findAll({
    where,
    order: [['dueDate', 'ASC'], ['createdAt', 'ASC']],
    raw: true,
  });
  const caseById = new Map(caseRows.map((c) => [c.id, c]));
  // Project into the legacy task shape the frontend already consumes
  // so the dashboard calendar keeps working without a UI change.
  return rows.map((r) => ({
    id: r.id,
    caseId: r.caseId,
    title: r.title || (r.body || '').slice(0, 80) || 'Task',
    status: r.status || 'open',
    priority: r.priority || 'normal',
    dueDate: r.dueDate,
    case: caseById.get(r.caseId) || null,
  }));
}

async function create(userId, caseId, payload = {}) {
  const c = await assertAccess(userId, caseId);
  const title = String(payload.title || '').trim();
  if (!title) throw { statusCode: 422, message: 'title is required' };
  if (payload.assigneeUserId) {
    await assertAssigneeAllowed(c, payload.assigneeUserId);
  }
  // Append at the end by default.
  const last = await CaseTask.findOne({
    where: { caseId },
    order: [['position', 'DESC']],
    attributes: ['position'],
    raw: true,
  });
  const nextPosition = last ? (Number(last.position) || 0) + 1 : 0;

  const row = await CaseTask.create({
    caseId,
    title,
    description: String(payload.description || '').trim() || null,
    assigneeUserId: payload.assigneeUserId || null,
    dueDate: normalizeDueDate(payload.dueDate),
    status: payload.status ? normalizeStatus(payload.status) : 'open',
    priority: normalizePriority(payload.priority),
    position: nextPosition,
    createdByUserId: userId,
  });
  return row.get({ plain: true });
}

async function update(userId, caseId, taskId, payload = {}) {
  const c = await assertAccess(userId, caseId);
  const row = await CaseTask.findOne({ where: { id: taskId, caseId } });
  if (!row) throw { statusCode: 404, message: 'Task not found' };

  const patch = {};
  if (payload.title !== undefined) {
    const t = String(payload.title || '').trim();
    if (!t) throw { statusCode: 422, message: 'title cannot be empty' };
    patch.title = t;
  }
  if (payload.description !== undefined) {
    patch.description = String(payload.description || '').trim() || null;
  }
  if (payload.assigneeUserId !== undefined) {
    if (payload.assigneeUserId) {
      await assertAssigneeAllowed(c, payload.assigneeUserId);
    }
    patch.assigneeUserId = payload.assigneeUserId || null;
  }
  if (payload.dueDate !== undefined) {
    patch.dueDate = normalizeDueDate(payload.dueDate);
  }
  if (payload.priority !== undefined) {
    patch.priority = normalizePriority(payload.priority);
  }
  if (payload.status !== undefined) {
    const next = normalizeStatus(payload.status);
    patch.status = next;
    // Stamp completion when transitioning into done, clear it on revert.
    if (next === 'done' && row.status !== 'done') {
      patch.completedAt = new Date();
      patch.completedByUserId = userId;
    } else if (next !== 'done' && row.status === 'done') {
      patch.completedAt = null;
      patch.completedByUserId = null;
    }
  }

  await row.update(patch);
  return row.get({ plain: true });
}

async function remove(userId, caseId, taskId) {
  await assertAccess(userId, caseId);
  const row = await CaseTask.findOne({ where: { id: taskId, caseId } });
  if (!row) throw { statusCode: 404, message: 'Task not found' };
  await row.destroy();
  return { id: taskId };
}

/**
 * Set task ordering from a flat list of taskIds. IDs not in the list
 * keep their existing position (lets the caller send partial updates).
 */
async function reorder(userId, caseId, orderedIds) {
  await assertAccess(userId, caseId);
  if (!Array.isArray(orderedIds)) {
    throw { statusCode: 422, message: 'orderedIds must be an array' };
  }
  // Wrap in a transaction so partial reorders don't leave half the
  // list with stale positions on a crash.
  const sequelize = CaseTask.sequelize;
  await sequelize.transaction(async (t) => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      const id = orderedIds[i];
      await CaseTask.update(
        { position: i },
        { where: { id, caseId }, transaction: t }
      );
    }
  });
  return listForCase(userId, caseId);
}

module.exports = {
  listForCase,
  listMineUpcoming,
  create,
  update,
  remove,
  reorder,
};
