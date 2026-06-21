// reminderService — CRUD for the professional dashboard calendar reminders.
// All operations are scoped to the calling user; no cross-user access.

const { Op } = require('sequelize');
const {
  ProfessionalReminder,
  Booking,
  Case,
  ProfessionalDetail,
} = require('../models');

/**
 * Helper: pull the bookingId / caseId out of a create/update payload,
 * verifying they actually belong to the caller. Stops a pro from
 * attaching a reminder to someone else's booking or case.
 *
 * Booking + Case both store `professionalId` as a ProfessionalDetail id
 * (NOT a user id), so we resolve the caller's user → professionalId
 * once and match against that. `clientId` is a plain user id.
 */
async function resolveLinks(userId, payload) {
  const out = {};
  if (!payload.bookingId && !payload.caseId) return out;

  const detail = await ProfessionalDetail.findOne({
    where: { userId },
    attributes: ['id'],
    raw: true,
  });
  const myProfessionalId = detail ? detail.id : null;

  if (payload.bookingId) {
    const b = await Booking.findOne({
      where: { id: payload.bookingId },
      raw: true,
    });
    if (
      b &&
      ((myProfessionalId && b.professionalId === myProfessionalId) ||
        b.clientId === userId)
    ) {
      out.bookingId = b.id;
    }
  }
  if (payload.caseId) {
    const c = await Case.findOne({
      where: { id: payload.caseId },
      raw: true,
    });
    if (
      c &&
      ((myProfessionalId && c.professionalId === myProfessionalId) ||
        c.clientId === userId)
    ) {
      out.caseId = c.id;
    }
  }
  return out;
}

/**
 * List reminders for the caller in a date window.
 * @param {string} userId
 * @param {{from?: string, to?: string}} window  YYYY-MM-DD strings
 */
async function listMine(userId, window = {}) {
  const where = { userId };
  if (window.from || window.to) {
    where.dueDate = {};
    if (window.from) where.dueDate[Op.gte] = window.from;
    if (window.to) where.dueDate[Op.lte] = window.to;
  }
  return ProfessionalReminder.findAll({
    where,
    order: [['dueDate', 'ASC'], ['createdAt', 'ASC']],
    raw: true,
  });
}

async function create(userId, payload = {}) {
  const title = String(payload.title || '').trim();
  if (!title) {
    throw { statusCode: 422, message: 'title is required' };
  }
  const dueDate = String(payload.dueDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw { statusCode: 422, message: 'dueDate must be YYYY-MM-DD' };
  }
  const links = await resolveLinks(userId, payload);
  const row = await ProfessionalReminder.create({
    userId,
    title,
    note: String(payload.note || '').trim() || null,
    dueDate,
    bookingId: links.bookingId || null,
    caseId: links.caseId || null,
  });
  return row.get({ plain: true });
}

async function update(userId, id, payload = {}) {
  const row = await ProfessionalReminder.findOne({
    where: { id, userId },
  });
  if (!row) throw { statusCode: 404, message: 'Reminder not found' };
  const patch = {};
  if (payload.title !== undefined) {
    const t = String(payload.title || '').trim();
    if (!t) throw { statusCode: 422, message: 'title cannot be empty' };
    patch.title = t;
  }
  if (payload.note !== undefined) {
    patch.note = String(payload.note || '').trim() || null;
  }
  if (payload.dueDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(payload.dueDate))) {
      throw { statusCode: 422, message: 'dueDate must be YYYY-MM-DD' };
    }
    patch.dueDate = payload.dueDate;
  }
  if (payload.done !== undefined) patch.done = !!payload.done;
  // Link changes — re-verify ownership each time.
  if (payload.bookingId !== undefined || payload.caseId !== undefined) {
    const links = await resolveLinks(userId, payload);
    if (payload.bookingId !== undefined) {
      patch.bookingId = payload.bookingId ? links.bookingId || null : null;
    }
    if (payload.caseId !== undefined) {
      patch.caseId = payload.caseId ? links.caseId || null : null;
    }
  }
  await row.update(patch);
  return row.get({ plain: true });
}

async function remove(userId, id) {
  const row = await ProfessionalReminder.findOne({
    where: { id, userId },
  });
  if (!row) throw { statusCode: 404, message: 'Reminder not found' };
  await row.destroy();
  return { id };
}

module.exports = { listMine, create, update, remove };
