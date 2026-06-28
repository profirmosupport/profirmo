// clientDocumentController — HTTP layer for the per-client document
// store. Upload goes through the standard `uploadSingle` multer
// middleware, then clientDocumentService persists into S3 + the
// ClientDocument row. Access requests + decisions are JSON.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const svc = require('../services/clientDocumentService');

const list = asyncHandler(async (req, res) => {
  const rows = await svc.listForClient(req.user.id, req.params.clientUserId);
  return successResponse(res, 200, 'Documents', rows);
});

const upload = asyncHandler(async (req, res) => {
  const row = await svc.uploadOne(
    req.user.id,
    req.params.clientUserId,
    req.file,
    {
      docKey: req.body && req.body.docKey,
      label: req.body && req.body.label,
      notes: req.body && req.body.notes,
      financialYear: req.body && req.body.financialYear,
    }
  );
  return successResponse(res, 201, 'Document uploaded', row);
});

const getUrl = asyncHandler(async (req, res) => {
  const out = await svc.getDocumentUrl(req.user.id, req.params.id);
  return successResponse(res, 200, 'Document URL', out);
});

const remove = asyncHandler(async (req, res) => {
  const out = await svc.deleteDocument(req.user.id, req.params.id);
  return successResponse(res, 200, 'Document deleted', out);
});

// --- Access ---------------------------------------------------------

const requestAccess = asyncHandler(async (req, res) => {
  const row = await svc.requestAccess(
    req.user.id,
    req.params.clientUserId,
    req.body && req.body.note
  );
  return successResponse(res, 201, 'Access requested', row);
});

const decideAccess = asyncHandler(async (req, res) => {
  const row = await svc.decideAccess(
    req.user.id,
    req.params.id,
    req.body && req.body.decision,
    req.body && req.body.note
  );
  return successResponse(res, 200, 'Decision recorded', row);
});

const listAccessForPro = asyncHandler(async (req, res) => {
  const rows = await svc.listAccessForPro(req.user.id);
  return successResponse(res, 200, 'Access records', rows);
});

const listAccessForClient = asyncHandler(async (req, res) => {
  const rows = await svc.listAccessForClient(req.user.id);
  return successResponse(res, 200, 'Access records', rows);
});

const getProAccessForClient = asyncHandler(async (req, res) => {
  const row = await svc.getProAccessForClient(
    req.user.id,
    req.params.clientUserId
  );
  return successResponse(res, 200, 'Access record', row);
});

module.exports = {
  list,
  upload,
  getUrl,
  remove,
  requestAccess,
  decideAccess,
  listAccessForPro,
  listAccessForClient,
  getProAccessForClient,
};
