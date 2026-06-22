const caseService = require('../services/caseService');
const storageService = require('../services/storageService');
const gates = require('../services/subscriptionGateService');
const auditService = require('../services/auditService');
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
  // Subscription gate: reject before we hit the DB if the user has
  // exhausted their plan's case_limit. We catch the structured error
  // locally so the response body carries `code: 'PLAN_LIMIT_REACHED'`
  // and the per-feature metadata — the global error handler would
  // otherwise strip these fields.
  try {
    // Categorise the case-in-progress by assignee count:
    //   * 1 assignee  -> individual case, gated against the ASSIGNEE's plan
    //                    (not the creator's). The form may let a firm admin
    //                    create cases on behalf of a member — we cap by
    //                    whoever the case is actually assigned to.
    //   * 2+ assignees -> firm case, gated against firmCaseLimit on the
    //                     firm OWNER's plan.
    const ids = Array.isArray(req.body && req.body.professionalIds)
      ? req.body.professionalIds.filter(Boolean)
      : [];
    const single = req.body && req.body.professionalId ? 1 : 0;
    const assigneeCount = ids.length || single;
    const userId = req.user && (req.user.id || req.user.sub);

    if (assigneeCount >= 2 && req.body && req.body.firmId) {
      await gates.enforceCanCreateFirmCase(req.body.firmId);
    } else if (assigneeCount === 1) {
      const assignee = ids[0] || req.body.professionalId;
      await gates.enforceCanAssignCaseToProfessional(assignee);
    } else {
      // Fallback when no assignee yet — gate by the caller's plan.
      await gates.enforceCanCreateCase(userId);
    }
  } catch (err) {
    if (err && err.code === 'PLAN_LIMIT_REACHED') {
      return res.status(err.statusCode || 403).json({
        success: false,
        message: err.message,
        errors: null,
        code: err.code,
        feature: err.feature,
        planName: err.planName,
        limit: err.limit,
        currentCount: err.currentCount,
      });
    }
    throw err;
  }
  const created = await caseService.create(req.body, req.user);
  auditService.recordCreate({
    req,
    entityType: 'case',
    entityId: created.id,
    after: created,
    summary: `Case "${created.title || created.id}" created`,
  });
  return successResponse(res, 201, 'Case created', created);
});

// PATCH /api/cases/:id
const updateCase = asyncHandler(async (req, res) => {
  // If the update is changing the assignee list, re-run the assignee-based
  // gate before persisting. We exclude this case's id from the counts so
  // reassigning to the same pro (or keeping them in a shrinking list)
  // doesn't double-count.
  const ids = Array.isArray(req.body && req.body.professionalIds)
    ? req.body.professionalIds.filter(Boolean)
    : null;
  if (ids !== null) {
    try {
      if (ids.length >= 2) {
        // Multi-assignee: gate against firm-case limit. Use firmId from the
        // payload if provided, otherwise from the existing case row.
        let firmId = req.body && req.body.firmId;
        if (!firmId) {
          const existing = await caseService.getById(req.params.id);
          firmId = existing && existing.firmId;
        }
        if (firmId) {
          await gates.enforceCanCreateFirmCase(firmId, req.params.id);
        }
      } else if (ids.length === 1) {
        await gates.enforceCanAssignCaseToProfessional(ids[0], req.params.id);
      }
    } catch (err) {
      if (err && err.code === 'PLAN_LIMIT_REACHED') {
        return res.status(err.statusCode || 403).json({
          success: false,
          message: err.message,
          errors: null,
          code: err.code,
          feature: err.feature,
          planName: err.planName,
          limit: err.limit,
          currentCount: err.currentCount,
        });
      }
      throw err;
    }
  }
  // Snapshot before mutating so the audit log can record the diff.
  const before = await caseService.getById(req.params.id);
  const updated = await caseService.update(req.params.id, req.body, req.user);
  if (!updated) throw notFound(req.params.id);
  auditService.recordUpdate({
    req,
    entityType: 'case',
    entityId: req.params.id,
    before: before || {},
    after: updated,
  });
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
  // Clients can delete only their own E-Courts-imported cases when no
  // professional has been assigned yet. Once a pro is on the case the
  // delete is locked — the professional handles the relationship.
  const existing = await caseService.getById(req.params.id);
  if (!existing) throw notFound(req.params.id);
  const role = String(req.user && req.user.role || '').toLowerCase();
  if (role === 'client') {
    const isOwner =
      existing.clientId === req.user.id ||
      (Array.isArray(existing.clientIds) && existing.clientIds.includes(req.user.id));
    const hasPro =
      !!existing.professionalId ||
      (Array.isArray(existing.professionalIds) && existing.professionalIds.length > 0);
    if (!isOwner) {
      throw { statusCode: 403, message: 'You can only delete your own cases.' };
    }
    if (hasPro) {
      throw {
        statusCode: 403,
        message:
          'A professional is already assigned to this case. Ask them to remove it, or contact support.',
      };
    }
  }
  const removed = await caseService.remove(req.params.id);
  if (!removed) throw notFound(req.params.id);
  auditService.recordDelete({
    req,
    entityType: 'case',
    entityId: req.params.id,
    before: existing,
    summary: `Case "${existing.title || req.params.id}" deleted`,
  });
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

/**
 * Shared authorisation gate for attachment endpoints. Verifies:
 *   - caller can access the case
 *   - the requested key belongs to that case (new format under
 *     `case-files/<caseId>/`, or a legacy key listed in this case's
 *     note/update attachments)
 *
 * Throws on failure; on success returns `{ caseRow, key }` for the
 * caller to use.
 */
const authoriseAttachmentAccess = async (req) => {
  const caseId = req.params.id;
  const key = String((req.query && req.query.key) || '').trim();
  if (!key) {
    throw { statusCode: 400, message: 'key query parameter is required.' };
  }
  const access = await caseService.userCanAccessCase(req.user, caseId);
  if (!access.allowed) {
    throw {
      statusCode: 403,
      message: 'You do not have permission to view this case.',
    };
  }
  const expectedPrefix = `case-files/${storageService.safeCaseSegment(caseId)}/`;
  let allowed = key.startsWith(expectedPrefix);
  if (!allowed) {
    const [notes, updates] = await Promise.all([
      caseService.listNotes(caseId),
      caseService.listUpdates(caseId),
    ]);
    const seen = new Set();
    for (const list of [notes, updates]) {
      for (const row of list || []) {
        for (const att of row.attachments || []) {
          if (att && att.url) seen.add(String(att.url));
        }
      }
    }
    allowed = seen.has(key);
  }
  if (!allowed) {
    throw {
      statusCode: 403,
      message: 'This file does not belong to the requested case.',
    };
  }
  return { caseRow: access.case, key };
};

// GET /api/cases/:id/attachments/url?key=<storedPath>
// Returns a short-lived presigned URL. KEPT for legacy callers; new
// frontend code prefers /attachments/stream which proxies the bytes
// (so a leaked URL is useless without an auth-bearing request).
const getAttachmentUrl = require('../utils/asyncHandler')(async (req, res) => {
  const { key } = await authoriseAttachmentAccess(req);
  const expiryMinutes = 5;
  const url = await storageService.getTemporaryFileUrl(key, expiryMinutes);
  const expiresAt = new Date(
    Date.now() + expiryMinutes * 60 * 1000
  ).toISOString();
  return require('../utils/responseHandler').successResponse(
    res,
    200,
    'Attachment URL',
    { url, expiresAt, expiryMinutes }
  );
});

// GET /api/cases/:id/attachments/stream?key=<storedPath>
// Streams the file body through the backend so every request is
// re-authorised. The browser never sees an S3 URL — even if someone
// copies the backend URL, it returns 401/403 without an auth-bearing
// request. Preferred over /attachments/url for new code.
const streamAttachment = require('../utils/asyncHandler')(async (req, res) => {
  const { key } = await authoriseAttachmentAccess(req);

  // Legacy `/uploads/<file>` paths are served by the local static
  // handler — redirect there. (The legacy attachment is auth-gated by
  // virtue of having been listed in this case's notes/updates, which
  // we just verified above.)
  if (key.startsWith('/uploads/')) {
    return res.redirect(302, key);
  }

  // Pull the S3 object and pipe it back. We resolve a presigned URL
  // server-side and HTTP-GET it ourselves so we don't ship the AWS SDK
  // streaming dependencies into every controller. Short cache header
  // is safe because the URL is unique per request.
  const presigned = await storageService.getTemporaryFileUrl(key, 1);
  let upstream;
  try {
    upstream = await fetch(presigned);
  } catch (err) {
    throw {
      statusCode: 502,
      message: 'Could not reach storage for this attachment.',
    };
  }
  if (!upstream.ok) {
    throw {
      statusCode: upstream.status === 404 ? 404 : 502,
      message: `Storage returned ${upstream.status} for this attachment.`,
    };
  }
  const contentType =
    upstream.headers.get('content-type') || 'application/octet-stream';
  const contentLength = upstream.headers.get('content-length');
  res.setHeader('Content-Type', contentType);
  if (contentLength) res.setHeader('Content-Length', contentLength);
  // Inline by default — image/PDF previews work in <img>/<embed>.
  // Filename comes from the trailing path segment so downloads pick a
  // sensible name.
  const baseName = key.split('/').filter(Boolean).pop() || 'attachment';
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${baseName.replace(/"/g, '')}"`
  );
  res.setHeader('Cache-Control', 'private, no-store');

  // Node 20's fetch returns a web ReadableStream. Convert to Node and
  // pipe through.
  const { Readable } = require('stream');
  if (upstream.body && typeof Readable.fromWeb === 'function') {
    return Readable.fromWeb(upstream.body).pipe(res);
  }
  // Fallback: buffer the whole body (small files only).
  const buf = Buffer.from(await upstream.arrayBuffer());
  return res.end(buf);
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
  getAttachmentUrl,
  streamAttachment,
};
