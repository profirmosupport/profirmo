// File controller for the Profirmo backend (Phase 4).
//
// Thin, asyncHandler-wrapped handlers for the /api/files endpoints. The
// heavy lifting (multer disk storage, MIME whitelist, size limit) happens
// in the upload middleware; the database logic lives in fileService.

const fileService = require('../services/fileService');
const caseService = require('../services/caseService');
const asyncHandler = require('../utils/asyncHandler');
const {
  successResponse,
  errorResponse,
} = require('../utils/responseHandler');

// Categories that scope to a specific case — uploads in these
// categories MUST carry a `caseId` and the caller must be authorised
// to view that case. The resulting object lands under
// `case-files/<caseId>/<uuid>.<ext>`.
const CASE_SCOPED_CATEGORIES = new Set([
  'case_note',
  'booking_note',
]);

// Known upload categories. `category` defaults to 'other' when omitted.
const CATEGORIES = [
  'profile_photo',
  'cover_photo',
  'resume',
  'license_document',
  'identity_document',
  'certification',
  'firm_logo',
  'firm_registration',
  'business_license',
  'tax_document',
  // Attachments dropped on booking notes + case notes by either side.
  'booking_note',
  'case_note',
  'other',
];

// Categories that must be an image (no PDFs).
const IMAGE_ONLY_CATEGORIES = [
  'profile_photo',
  'cover_photo',
  'firm_logo',
];

// Project an Upload record down to the public response shape.
const toPublicUpload = (u) => ({
  id: u.id,
  url: u.url,
  originalName: u.originalName,
  mimeType: u.mimeType,
  size: u.size,
  category: u.category,
  createdAt: u.createdAt,
});

// POST /api/files/upload — store one file and record it.
const uploadFile = asyncHandler(async (req, res) => {
  const { file } = req;
  if (!file) {
    return errorResponse(res, 400, 'No file provided. Use the "file" field.');
  }

  const category = (req.body.category || 'other').trim() || 'other';

  if (!CATEGORIES.includes(category)) {
    return errorResponse(
      res,
      400,
      `Invalid category. Allowed: ${CATEGORIES.join(', ')}.`
    );
  }

  const isImage = file.mimetype.startsWith('image/');
  const isPdf = file.mimetype === 'application/pdf';

  // Photo/logo categories must be images; document categories accept
  // images or PDFs. With memory storage there's no temp file to clean
  // up — multer's buffer is GC'd when the request ends.
  if (IMAGE_ONLY_CATEGORIES.includes(category) && !isImage) {
    return errorResponse(
      res,
      400,
      `Category "${category}" requires an image file.`
    );
  }
  if (!isImage && !isPdf) {
    return errorResponse(
      res,
      400,
      'Unsupported file type for this category.'
    );
  }

  // Case-scoped categories (case_note, booking_note) carry the case
  // they belong to so the object can land under
  // `case-files/<caseId>/<uuid>.ext`. We authorise the upload against
  // the case here so a stranger can't push junk into someone else's
  // folder by guessing a caseId.
  const rawCaseId =
    (req.body && (req.body.caseId || req.body.case_id || req.body.caseID)) ||
    '';
  const caseId = String(rawCaseId || '').trim();
  if (CASE_SCOPED_CATEGORIES.has(category)) {
    if (!caseId) {
      return errorResponse(
        res,
        400,
        `Category "${category}" requires a caseId so the file can be filed under that case.`
      );
    }
    if (!req.user || !req.user.id) {
      return errorResponse(res, 401, 'Sign in required to attach case files.');
    }
    const access = await caseService.userCanAccessCase(req.user, caseId);
    if (!access.allowed) {
      return errorResponse(
        res,
        403,
        'You do not have permission to attach files to this case.'
      );
    }
  } else if (caseId && req.user && req.user.id) {
    // Belt + braces — even when the caller passes a caseId on a
    // non-case category we still authorise it, so legacy callers that
    // tag `category=other` for case files don't accidentally upload
    // into another tenant's folder.
    const access = await caseService.userCanAccessCase(req.user, caseId);
    if (!access.allowed) {
      return errorResponse(
        res,
        403,
        'You do not have permission to attach files to this case.'
      );
    }
  }

  // Anonymous uploads (signup wizard, before account creation) are
  // permitted for non-case categories — the row carries `userId: null`
  // and the file lives until the registration links it via the
  // profile-photo / doc URL fields.
  const upload = await fileService.createUpload({
    userId: (req.user && req.user.id) || null,
    category,
    caseId: caseId || null,
    file,
  });

  return successResponse(
    res,
    201,
    'File uploaded',
    toPublicUpload(upload)
  );
});

// GET /api/files — list the caller's uploads.
const listFiles = asyncHandler(async (req, res) => {
  const uploads = await fileService.listUserUploads(req.user.id);
  return successResponse(
    res,
    200,
    'Uploads fetched',
    uploads.map(toPublicUpload)
  );
});

// GET /api/files/:id — single upload metadata.
const getFile = asyncHandler(async (req, res) => {
  const upload = await fileService.getUploadById(req.params.id);
  if (!upload) {
    return errorResponse(res, 404, 'Upload not found');
  }
  return successResponse(
    res,
    200,
    'Upload fetched',
    toPublicUpload(upload)
  );
});

// DELETE /api/files/:id — owner-scoped delete (row + file on disk).
const deleteFile = asyncHandler(async (req, res) => {
  const deleted = await fileService.deleteUpload(
    req.params.id,
    req.user.id
  );
  if (!deleted) {
    return errorResponse(res, 404, 'Upload not found');
  }
  return successResponse(res, 200, 'Upload deleted', { id: req.params.id });
});

module.exports = {
  uploadFile,
  listFiles,
  getFile,
  deleteFile,
};
