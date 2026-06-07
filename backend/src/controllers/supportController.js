// supportController — public submission + admin triage for the
// /contact form. Mounted at /api/support (public submit) and
// /api/admin/support (admin CRUD).

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const supportService = require('../services/supportService');
const { logAudit } = require('../utils/auditLogger');

// POST /api/support/contact — body: { name, email, subject, message }
const submitContact = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const ticket = await supportService.createTicket({
    name: body.name,
    email: body.email,
    subject: body.subject,
    message: body.message,
    userId: (req.user && req.user.id) || null,
    ipAddress: req.ip,
    userAgent: req.headers && req.headers['user-agent'],
  });
  return successResponse(res, 201, 'Ticket created', ticket);
});

// --- Admin -----------------------------------------------------------------

const adminList = asyncHandler(async (req, res) => {
  const result = await supportService.listTickets({
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search,
    status: req.query.status,
  });
  return successResponse(res, 200, 'Support tickets', result);
});

const adminGet = asyncHandler(async (req, res) => {
  const ticket = await supportService.getTicket(req.params.id);
  return successResponse(res, 200, 'Support ticket', ticket);
});

const adminSetStatus = asyncHandler(async (req, res) => {
  const adminId = req.user && req.user.id;
  const next = req.body && req.body.status;
  const ticket = await supportService.setStatus(req.params.id, next);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.support_status_changed',
    entity: 'support_ticket',
    entityId: ticket.id,
    status: 'success',
    metadata: { status: next },
  });
  return successResponse(res, 200, 'Ticket updated', ticket);
});

const adminSetNote = asyncHandler(async (req, res) => {
  const adminId = req.user && req.user.id;
  const note = req.body && req.body.adminNote;
  const ticket = await supportService.setAdminNote(req.params.id, note);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.support_note_updated',
    entity: 'support_ticket',
    entityId: ticket.id,
    status: 'success',
    metadata: {},
  });
  return successResponse(res, 200, 'Note saved', ticket);
});

const adminRemove = asyncHandler(async (req, res) => {
  const adminId = req.user && req.user.id;
  const result = await supportService.removeTicket(req.params.id);
  await logAudit({
    req,
    userId: adminId,
    action: 'admin.support_deleted',
    entity: 'support_ticket',
    entityId: result.id,
    status: 'success',
    metadata: {},
  });
  return successResponse(res, 200, 'Ticket deleted', result);
});

module.exports = {
  submitContact,
  adminList,
  adminGet,
  adminSetStatus,
  adminSetNote,
  adminRemove,
};
