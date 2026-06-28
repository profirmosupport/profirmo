// caseTaskController — thin HTTP layer over caseTaskService. All routes
// authenticate; ownership is enforced inside the service so the
// controller doesn't have to repeat the check.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const caseTaskService = require('../services/caseTaskService');

const list = asyncHandler(async (req, res) => {
  const items = await caseTaskService.listForCase(
    req.user.id,
    req.params.caseId
  );
  return successResponse(res, 200, 'Tasks fetched', items);
});

const listMine = asyncHandler(async (req, res) => {
  const items = await caseTaskService.listMineUpcoming(req.user.id, {
    from: req.query.from,
    to: req.query.to,
  });
  return successResponse(res, 200, 'Upcoming tasks fetched', items);
});

const create = asyncHandler(async (req, res) => {
  const row = await caseTaskService.create(
    req.user.id,
    req.params.caseId,
    req.body || {}
  );
  return successResponse(res, 201, 'Task created', row);
});

const update = asyncHandler(async (req, res) => {
  const row = await caseTaskService.update(
    req.user.id,
    req.params.caseId,
    req.params.taskId,
    req.body || {}
  );
  return successResponse(res, 200, 'Task updated', row);
});

const remove = asyncHandler(async (req, res) => {
  const out = await caseTaskService.remove(
    req.user.id,
    req.params.caseId,
    req.params.taskId
  );
  return successResponse(res, 200, 'Task deleted', out);
});

const reorder = asyncHandler(async (req, res) => {
  const out = await caseTaskService.reorder(
    req.user.id,
    req.params.caseId,
    (req.body && req.body.orderedIds) || []
  );
  return successResponse(res, 200, 'Tasks reordered', out);
});

module.exports = { list, listMine, create, update, remove, reorder };
