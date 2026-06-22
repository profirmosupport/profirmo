// reminderController — thin wrapper around reminderService. All routes
// require auth; the caller is always the owning professional. Every
// mutation also emits an audit row so the trail survives even if the
// reminder is later deleted.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const reminderService = require('../services/reminderService');
const auditService = require('../services/auditService');

const list = asyncHandler(async (req, res) => {
  const items = await reminderService.listMine(req.user.id, {
    from: req.query.from,
    to: req.query.to,
  });
  return successResponse(res, 200, 'Reminders fetched', items);
});

const create = asyncHandler(async (req, res) => {
  const row = await reminderService.create(req.user.id, req.body || {});
  auditService.recordCreate({
    req,
    entityType: 'reminder',
    entityId: row.id,
    after: row,
    summary: `Reminder "${row.title}" scheduled for ${row.dueDate}`,
  });
  return successResponse(res, 201, 'Reminder created', row);
});

const update = asyncHandler(async (req, res) => {
  // Snapshot before update so the audit diff is minimal.
  const beforeList = await reminderService.listMine(req.user.id, {});
  const before = beforeList.find((r) => r.id === req.params.id) || {};
  const row = await reminderService.update(
    req.user.id,
    req.params.id,
    req.body || {}
  );
  auditService.recordUpdate({
    req,
    entityType: 'reminder',
    entityId: req.params.id,
    before,
    after: row,
  });
  return successResponse(res, 200, 'Reminder updated', row);
});

const remove = asyncHandler(async (req, res) => {
  const beforeList = await reminderService.listMine(req.user.id, {});
  const before = beforeList.find((r) => r.id === req.params.id) || null;
  const out = await reminderService.remove(req.user.id, req.params.id);
  auditService.recordDelete({
    req,
    entityType: 'reminder',
    entityId: req.params.id,
    before: before || { id: req.params.id },
    summary: before ? `Reminder "${before.title}" deleted` : 'Reminder deleted',
  });
  return successResponse(res, 200, 'Reminder deleted', out);
});

module.exports = { list, create, update, remove };
