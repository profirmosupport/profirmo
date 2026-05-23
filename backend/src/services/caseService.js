const { Op } = require('sequelize');
const {
  Case,
  File,
  CaseNote,
  CaseLog,
  User,
  ProfessionalDetail,
  LawFirm,
  FirmMember,
} = require('../models');
const { paginate } = require('./professionalService');
const notificationService = require('./notificationService');

// Fire-and-forget notification — failures never break the request.
const notify = async (params) => {
  try {
    await notificationService.createNotification(params);
  } catch (err) {
    console.warn(`[caseNotify] failed: ${err.message}`);
  }
};

// Resolve the public professional id (user.linkedId || detail.id) -> userId
// so we can target a notification at the assigned professional.
const resolveProfessionalUserId = async (publicProfId) => {
  if (!publicProfId) return null;
  // Try linkedId first (legacy/back-fill style ids like prof-N).
  const byLinked = await User.findOne({
    where: { linkedId: publicProfId },
    raw: true,
  });
  if (byLinked) return byLinked.id;
  // Otherwise treat the id as a ProfessionalDetail.id.
  const detail = await ProfessionalDetail.findByPk(publicProfId, { raw: true });
  return detail ? detail.userId : null;
};

const displayName = (u) =>
  (u && (u.fullName ||
    [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
    u.name)) || '';

/** Write a single CaseLog row. Failures are non-fatal. */
const writeLog = async (caseId, actor, action, message, metadata) => {
  try {
    await CaseLog.create({
      caseId,
      actorUserId: (actor && actor.id) || null,
      actorName: displayName(actor) || '',
      action,
      message: message || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch (err) {
    // best-effort log
    console.warn(`[caseLog] failed: ${err.message}`);
  }
};

// Attach the related `files` array to a plain case object so JSON responses
// keep the same shape the frontend expects.
const withFiles = async (caseObj) => {
  if (!caseObj) return caseObj;
  const files = await File.findAll({
    where: { caseId: caseObj.id },
    raw: true,
  });
  return { ...caseObj, files };
};

// Resolve `clientId` (users.id) → `{ id, name, phone, email, city }` so the
// frontend can display the client without a second round-trip.
const attachClients = async (cases) => {
  if (!Array.isArray(cases) || cases.length === 0) return cases;
  const ids = [...new Set(cases.map((c) => c.clientId).filter(Boolean))];
  if (ids.length === 0) {
    return cases.map((c) => ({ ...c, client: null }));
  }
  const users = await User.findAll({
    where: { id: { [Op.in]: ids } },
    raw: true,
  });
  const byId = new Map(
    users.map((u) => [
      u.id,
      {
        id: u.id,
        name: displayName(u),
        phone: u.mobileNumber || '',
        email: u.email || '',
        city: u.city || '',
      },
    ])
  );
  return cases.map((c) => ({ ...c, client: byId.get(c.clientId) || null }));
};

const attachClient = async (caseObj) => {
  if (!caseObj) return caseObj;
  const [decorated] = await attachClients([caseObj]);
  return decorated;
};

// Run both decorators (files + client) on a single case.
const decorate = async (caseObj) => attachClient(await withFiles(caseObj));

// Run both decorators on an array of cases.
const decorateAll = async (cases) =>
  attachClients(await Promise.all(cases.map(withFiles)));

// Persist an array of file descriptors as File rows for a given case.
const saveFiles = async (caseId, files) => {
  if (!Array.isArray(files) || files.length === 0) return;
  const rows = files.map((f) => ({
    ...(f.id ? { id: f.id } : {}),
    caseId,
    name: f.name || '',
    size: f.size === undefined || f.size === null ? '' : String(f.size),
    type: f.type || 'application/octet-stream',
    uploadedAt: f.uploadedAt || new Date().toISOString(),
  }));
  await File.bulkCreate(rows);
};

/**
 * List cases with optional filters and pagination.
 * Supported filters: status, category, clientId, professionalId, firmId.
 * @returns {Promise<{ items, page, limit, total }>}
 */
const list = async ({ filters = {}, page, limit } = {}) => {
  const { page: p, limit: l, offset } = paginate(page, limit);
  const where = {};

  if (filters.status) where.status = String(filters.status);
  if (filters.category) where.category = String(filters.category);
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.professionalId) where.professionalId = filters.professionalId;
  if (filters.firmId) where.firmId = filters.firmId;

  const { rows, count } = await Case.findAndCountAll({
    where,
    limit: l,
    offset,
    raw: true,
  });

  const items = await decorateAll(rows);
  return { items, page: p, limit: l, total: count };
};

/** Find a case by id (with files), or null when not found. */
const getById = async (id) => {
  const found = await Case.findByPk(id, { raw: true });
  if (!found) return null;
  return decorate(found);
};

/** Create a new case record. Auto-logs the creation. */
const create = async (data = {}, actor = null) => {
  const newCase = await Case.create({
    clientId: data.clientId || null,
    professionalId: data.professionalId || null,
    firmId: data.firmId || null,
    title: data.title,
    category: data.category,
    status: data.status || 'open',
    description: data.description || null,
    priority: data.priority || 'medium',
    caseNumber: data.caseNumber || null,
    courtName: data.courtName || null,
    opposingParty: data.opposingParty || null,
    nextHearingDate: data.nextHearingDate || null,
    assignedByUserId:
      data.professionalId && actor ? actor.id : data.assignedByUserId || null,
    assignedAt: data.professionalId ? new Date() : null,
  });

  if (Array.isArray(data.files) && data.files.length > 0) {
    await saveFiles(newCase.id, data.files);
  }

  await writeLog(
    newCase.id,
    actor,
    'created',
    `Case "${newCase.title}" created.`,
    { status: newCase.status, priority: newCase.priority }
  );
  if (newCase.professionalId) {
    await writeLog(
      newCase.id,
      actor,
      'assigned',
      `Assigned to ${newCase.professionalId}.`,
      { professionalId: newCase.professionalId }
    );
    // Notify the assigned professional that they have a new case.
    const assignedUserId = await resolveProfessionalUserId(
      newCase.professionalId
    );
    if (assignedUserId && (!actor || assignedUserId !== actor.id)) {
      await notify({
        userId: assignedUserId,
        type: 'case_assigned',
        title: 'New case assigned',
        message: `You have been assigned "${newCase.title}".`,
        link: `/dashboard/professional/cases/${newCase.id}`,
        metadata: { caseId: newCase.id },
      });
    }
  }

  return decorate(newCase.get({ plain: true }));
};

/** Update an existing case record. Returns null when not found. */
const update = async (id, data = {}, actor = null) => {
  const found = await Case.findByPk(id);
  if (!found) return null;

  const updatable = [
    'professionalId',
    'firmId',
    'title',
    'category',
    'status',
    'description',
    'priority',
    'caseNumber',
    'courtName',
    'opposingParty',
    'nextHearingDate',
  ];
  const changes = {};
  const prevValues = found.get({ plain: true });
  updatable.forEach((field) => {
    if (data[field] !== undefined && data[field] !== prevValues[field]) {
      changes[field] = data[field];
    }
  });

  if (Object.keys(changes).length > 0) {
    if (changes.professionalId !== undefined) {
      changes.assignedByUserId = actor ? actor.id : null;
      changes.assignedAt = new Date();
    }
    await found.update(changes);

    // Emit a separate log entry per meaningful change.
    if (changes.status) {
      await writeLog(
        id,
        actor,
        'status_changed',
        `Status changed from "${prevValues.status}" to "${changes.status}".`,
        { from: prevValues.status, to: changes.status }
      );
    }
    if (changes.professionalId !== undefined) {
      await writeLog(
        id,
        actor,
        'assigned',
        `Case re-assigned to ${changes.professionalId}.`,
        { from: prevValues.professionalId, to: changes.professionalId }
      );
      // Notify the new assignee (skip if they're the actor doing the reassign).
      const newAssigneeUserId = await resolveProfessionalUserId(
        changes.professionalId
      );
      if (newAssigneeUserId && (!actor || newAssigneeUserId !== actor.id)) {
        await notify({
          userId: newAssigneeUserId,
          type: 'case_assigned',
          title: 'Case assigned to you',
          message: `You have been assigned "${found.title}".`,
          link: `/dashboard/professional/cases/${id}`,
          metadata: { caseId: id },
        });
      }
    }
    const otherChanged = Object.keys(changes).filter(
      (k) =>
        !['status', 'professionalId', 'assignedByUserId', 'assignedAt'].includes(
          k
        )
    );
    if (otherChanged.length > 0) {
      await writeLog(
        id,
        actor,
        'updated',
        `Updated: ${otherChanged.join(', ')}.`,
        { fields: otherChanged }
      );
    }
  }

  // If a files array is supplied, replace the case's file rows.
  if (data.files !== undefined) {
    await File.destroy({ where: { caseId: id } });
    await saveFiles(id, Array.isArray(data.files) ? data.files : []);
  }

  return decorate(found.get({ plain: true }));
};

/** Delete a case record (and its files). Returns the removed case or null. */
const remove = async (id) => {
  const found = await Case.findByPk(id, { raw: true });
  if (!found) return null;
  const removed = await decorate(found);
  await File.destroy({ where: { caseId: id } });
  await Case.destroy({ where: { id } });
  return removed;
};

/** Get all cases for a given client (with files + client info). */
const getByClient = async (clientId) => {
  const rows = await Case.findAll({ where: { clientId }, raw: true });
  return decorateAll(rows);
};

/** Get all cases for a given professional (with files + client info). */
const getByProfessional = async (professionalId) => {
  const rows = await Case.findAll({
    where: { professionalId },
    raw: true,
  });
  return decorateAll(rows);
};

/** Resolve the caller's public professional id (user.linkedId || detail.id). */
const resolveActorProfessionalId = async (user) => {
  if (!user || !user.id) return null;
  if (user.linkedId) return user.linkedId;
  const detail = await ProfessionalDetail.findOne({
    where: { userId: user.id },
    raw: true,
  });
  return detail ? detail.id : null;
};

/** Resolve the public firm id (legacyFirmId || law_firms.id) the user owns. */
const resolveActorFirmId = async (user) => {
  if (!user || !user.id) return null;
  const firm = await LawFirm.findOne({
    where: { ownerUserId: user.id },
    raw: true,
  });
  if (firm) return firm.legacyFirmId || firm.id;
  // Also check co-owner / member firm membership.
  const detail = await ProfessionalDetail.findOne({
    where: { userId: user.id },
    raw: true,
  });
  if (!detail) return null;
  const member = await FirmMember.findOne({
    where: { professionalId: detail.id, status: 'active' },
    raw: true,
  });
  if (!member) return null;
  const lf = await LawFirm.findByPk(member.firmId, { raw: true });
  return lf ? lf.legacyFirmId || lf.id : null;
};

/** Cases assigned to the calling professional (or in their firm). */
const listMine = async (user) => {
  const professionalId = await resolveActorProfessionalId(user);
  if (!professionalId) return [];
  const rows = await Case.findAll({
    where: { professionalId },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  return decorateAll(rows);
};

/** Cases where the caller is the client (clientId = users.id, role='client'). */
const listMineAsClient = async (user) => {
  if (!user || user.role !== 'client') return [];
  const rows = await Case.findAll({
    where: { clientId: user.id },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  return decorateAll(rows);
};

/** Cases for the caller's firm (owner / co-owner / member). */
const listForFirm = async (user) => {
  const firmId = await resolveActorFirmId(user);
  if (!firmId) return { firmId: null, items: [] };
  const rows = await Case.findAll({
    where: { firmId },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  const items = await decorateAll(rows);
  return { firmId, items };
};

// --- Notes -----------------------------------------------------------------

/** Append a note to a case. */
const addNote = async (caseId, user, body) => {
  if (!body || !String(body).trim()) {
    throw { statusCode: 422, message: 'Note body is required.' };
  }
  const found = await Case.findByPk(caseId);
  if (!found) throw { statusCode: 404, message: 'Case not found.' };
  const note = await CaseNote.create({
    caseId,
    authorUserId: (user && user.id) || null,
    authorName: displayName(user) || '',
    body: String(body).trim(),
  });
  await writeLog(caseId, user, 'note_added', 'A note was added.', {
    noteId: note.id,
  });
  return note.get({ plain: true });
};

/** Notes for a case, newest first. */
const listNotes = async (caseId) =>
  CaseNote.findAll({
    where: { caseId },
    order: [['createdAt', 'DESC']],
    raw: true,
  });

/** Log entries for a case, newest first. */
const listLog = async (caseId) =>
  CaseLog.findAll({
    where: { caseId },
    order: [['createdAt', 'DESC']],
    raw: true,
  });

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  getByClient,
  getByProfessional,
  listMine,
  listMineAsClient,
  listForFirm,
  addNote,
  listNotes,
  listLog,
};
