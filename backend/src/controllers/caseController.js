const caseService = require('../services/caseService');
const asyncHandler = require('../utils/asyncHandler');
const {
  successResponse,
  paginatedResponse,
} = require('../utils/responseHandler');

const notFound = (id) => ({
  statusCode: 404,
  message: `Case not found: ${id}`,
});

// GET /api/cases
const listCases = asyncHandler(async (req, res) => {
  const { page, limit, ...filters } = req.query;
  const { items, ...meta } = await caseService.list({ filters, page, limit });
  return paginatedResponse(res, 'Cases fetched', items, meta);
});

// GET /api/cases/:id
const getCase = asyncHandler(async (req, res) => {
  const found = await caseService.getById(req.params.id);
  if (!found) throw notFound(req.params.id);
  return successResponse(res, 200, 'Case fetched', found);
});

// POST /api/cases
const createCase = asyncHandler(async (req, res) => {
  const created = await caseService.create(req.body, req.user);
  return successResponse(res, 201, 'Case created', created);
});

// PATCH /api/cases/:id
const updateCase = asyncHandler(async (req, res) => {
  const updated = await caseService.update(req.params.id, req.body, req.user);
  if (!updated) throw notFound(req.params.id);
  return successResponse(res, 200, 'Case updated', updated);
});

// GET /api/cases/mine — cases assigned to the calling professional.
const getMyCases = asyncHandler(async (req, res) => {
  const cases = await caseService.listMine(req.user);
  return successResponse(res, 200, 'Your cases fetched', cases);
});

// GET /api/cases/mine-as-client — cases where the caller is the client.
const getMyClientCases = asyncHandler(async (req, res) => {
  const cases = await caseService.listMineAsClient(req.user);
  return successResponse(res, 200, 'Your cases fetched', cases);
});

// GET /api/cases/firm — cases for the caller's firm (owner / co-owner / member).
const getFirmCases = asyncHandler(async (req, res) => {
  const data = await caseService.listForFirm(req.user);
  return successResponse(res, 200, 'Firm cases fetched', data);
});

// GET /api/cases/:id/notes
const getCaseNotes = asyncHandler(async (req, res) => {
  const notes = await caseService.listNotes(req.params.id);
  return successResponse(res, 200, 'Case notes fetched', notes);
});

// POST /api/cases/:id/notes — accepts { body, attachments? }.
const addCaseNote = asyncHandler(async (req, res) => {
  const note = await caseService.addNote(
    req.params.id,
    req.user,
    req.body || {}
  );
  return successResponse(res, 201, 'Note added', note);
});

// PATCH /api/cases/:id/notes/:noteId — partial body of { body, attachments }.
const editCaseNote = asyncHandler(async (req, res) => {
  const note = await caseService.editNote(
    req.params.noteId,
    req.user,
    req.body || {}
  );
  if (!note) throw { statusCode: 404, message: 'Note not found.' };
  return successResponse(res, 200, 'Note edited', note);
});

// DELETE /api/cases/:id/notes/:noteId
const deleteCaseNote = asyncHandler(async (req, res) => {
  const removed = await caseService.deleteNote(req.params.noteId, req.user);
  if (!removed) throw { statusCode: 404, message: 'Note not found.' };
  return successResponse(res, 200, 'Note deleted', removed);
});

// DELETE /api/cases/:id/updates/:updateId
const deleteCaseUpdate = asyncHandler(async (req, res) => {
  const removed = await caseService.deleteUpdate(
    req.params.updateId,
    req.user
  );
  if (!removed) throw { statusCode: 404, message: 'Update not found.' };
  return successResponse(res, 200, 'Update deleted', removed);
});

// GET /api/cases/:id/log
const getCaseLog = asyncHandler(async (req, res) => {
  const entries = await caseService.listLog(req.params.id);
  return successResponse(res, 200, 'Case log fetched', entries);
});

// DELETE /api/cases/:id
const deleteCase = asyncHandler(async (req, res) => {
  const removed = await caseService.remove(req.params.id);
  if (!removed) throw notFound(req.params.id);
  return successResponse(res, 200, 'Case deleted', removed);
});

// GET /api/cases/client/:clientId
const getCasesByClient = asyncHandler(async (req, res) => {
  const cases = await caseService.getByClient(req.params.clientId);
  return successResponse(res, 200, 'Client cases fetched', cases);
});

// GET /api/cases/professional/:professionalId
const getCasesByProfessional = asyncHandler(async (req, res) => {
  const cases = await caseService.getByProfessional(
    req.params.professionalId
  );
  return successResponse(res, 200, 'Professional cases fetched', cases);
});

// GET /api/cases/:id/updates
const listCaseUpdates = asyncHandler(async (req, res) => {
  const updates = await caseService.listUpdates(req.params.id);
  return successResponse(res, 200, 'Case updates fetched', updates);
});

// POST /api/cases/:id/updates
const addCaseUpdate = asyncHandler(async (req, res) => {
  const update = await caseService.addUpdate(
    req.params.id,
    req.user,
    req.body
  );
  return successResponse(res, 201, 'Update added', update);
});

// PATCH /api/cases/:id/updates/:updateId
const editCaseUpdate = asyncHandler(async (req, res) => {
  const update = await caseService.editUpdate(
    req.params.updateId,
    req.user,
    req.body
  );
  if (!update) {
    throw { statusCode: 404, message: 'Update not found.' };
  }
  return successResponse(res, 200, 'Update edited', update);
});

module.exports = {
  listCases,
  getCase,
  createCase,
  updateCase,
  deleteCase,
  getCasesByClient,
  getCasesByProfessional,
  getMyCases,
  getMyClientCases,
  getFirmCases,
  getCaseNotes,
  addCaseNote,
  editCaseNote,
  deleteCaseNote,
  deleteCaseUpdate,
  getCaseLog,
  listCaseUpdates,
  addCaseUpdate,
  editCaseUpdate,
};
