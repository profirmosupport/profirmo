// auditController — read-only access to the audit log. Visibility rules:
//   * Cases: any participant (client or assigned professional) may read.
//   * Case tasks: anyone with access to the parent case.
//   * Bookings: client + assigned professional.
//   * Reminders: only the owning professional.
// Admins (role === 'admin') can read everything.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const auditService = require('../services/auditService');
const {
  Case,
  Booking,
  CaseTask,
  ProfessionalReminder,
  ProfessionalDetail,
} = require('../models');

async function myProfessionalId(userId) {
  const detail = await ProfessionalDetail.findOne({
    where: { userId },
    attributes: ['id'],
    raw: true,
  });
  return detail ? detail.id : null;
}

async function canReadCase(userId, caseId) {
  const c = await Case.findOne({ where: { id: caseId }, raw: true });
  if (!c) return false;
  if (c.clientId === userId) return true;
  if (Array.isArray(c.clientIds) && c.clientIds.includes(userId)) return true;
  const proId = await myProfessionalId(userId);
  if (!proId) return false;
  if (c.professionalId === proId) return true;
  if (Array.isArray(c.professionalIds) && c.professionalIds.includes(proId)) {
    return true;
  }
  return false;
}

async function canReadBooking(userId, bookingId) {
  const b = await Booking.findOne({ where: { id: bookingId }, raw: true });
  if (!b) return false;
  if (b.clientId === userId) return true;
  const proId = await myProfessionalId(userId);
  return proId && b.professionalId === proId;
}

async function canReadCaseTask(userId, taskId) {
  const t = await CaseTask.findOne({
    where: { id: taskId },
    attributes: ['caseId'],
    raw: true,
  });
  return t ? canReadCase(userId, t.caseId) : false;
}

async function canReadReminder(userId, reminderId) {
  const r = await ProfessionalReminder.findOne({
    where: { id: reminderId },
    attributes: ['userId'],
    raw: true,
  });
  return r ? r.userId === userId : false;
}

const list = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const role = String((req.user && req.user.role) || '').toLowerCase();
  const userId = req.user.id;

  let allowed = role === 'admin';
  if (!allowed) {
    if (entityType === 'case') allowed = await canReadCase(userId, entityId);
    else if (entityType === 'booking') allowed = await canReadBooking(userId, entityId);
    else if (entityType === 'case_task') allowed = await canReadCaseTask(userId, entityId);
    else if (entityType === 'reminder') allowed = await canReadReminder(userId, entityId);
  }
  if (!allowed) {
    throw { statusCode: 403, message: 'You do not have access to this audit trail.' };
  }

  const events = await auditService.listForEntity(entityType, entityId, {
    limit: Math.min(Number(req.query.limit) || 200, 500),
  });
  return successResponse(res, 200, 'Audit trail fetched', events);
});

module.exports = { list };
