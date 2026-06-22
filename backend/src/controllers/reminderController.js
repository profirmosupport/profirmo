// reminderController — thin wrapper around reminderService. All routes
// require auth; the caller is always the owning professional.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const reminderService = require('../services/reminderService');

const list = asyncHandler(async (req, res) => {
  const items = await reminderService.listMine(req.user.id, {
    from: req.query.from,
    to: req.query.to,
  });
  return successResponse(res, 200, 'Reminders fetched', items);
});

const create = asyncHandler(async (req, res) => {
  const row = await reminderService.create(req.user.id, req.body || {});
  return successResponse(res, 201, 'Reminder created', row);
});

const update = asyncHandler(async (req, res) => {
  const row = await reminderService.update(
    req.user.id,
    req.params.id,
    req.body || {}
  );
  return successResponse(res, 200, 'Reminder updated', row);
});

const remove = asyncHandler(async (req, res) => {
  const out = await reminderService.remove(req.user.id, req.params.id);
  return successResponse(res, 200, 'Reminder deleted', out);
});

module.exports = { list, create, update, remove };
