// caseTaskRoutes — case-scoped task endpoints. The /:caseId prefix is
// applied when mounted in app.js so the URL reads /api/cases/:caseId/tasks.
//
// Also exposes a flat /api/case-tasks/mine endpoint for surfacing the
// caller's open work on the dashboard calendar.

const express = require('express');
const caseTaskController = require('../controllers/caseTaskController');
const { authenticate } = require('../middleware/authMiddleware');

// Per-case router — mounted under /api/cases/:caseId/tasks. Inherits
// :caseId from the parent path so service calls can read it.
const perCaseRouter = express.Router({ mergeParams: true });
perCaseRouter.use(authenticate);
perCaseRouter.get('/', caseTaskController.list);
perCaseRouter.post('/', caseTaskController.create);
perCaseRouter.post('/reorder', caseTaskController.reorder);
perCaseRouter.patch('/:taskId', caseTaskController.update);
perCaseRouter.delete('/:taskId', caseTaskController.remove);

// Flat "my open tasks" router — mounted under /api/case-tasks.
const flatRouter = express.Router();
flatRouter.use(authenticate);
flatRouter.get('/mine', caseTaskController.listMine);

module.exports = { perCaseRouter, flatRouter };
