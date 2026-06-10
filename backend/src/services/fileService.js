// File service for the Profirmo backend.
//
// Database logic behind the /api/files endpoints: recording uploaded
// files in the `uploads` table, listing a user's uploads, fetching a
// single upload, and deleting an upload. The actual byte persistence is
// delegated to storageService — local disk OR AWS S3, switched live from
// the admin panel.

const { Upload } = require('../models');
const storageService = require('./storageService');
const { compressToTargetBytes } = require('../utils/imageCompressor');

// Per-category compression ceiling for IMAGE uploads, in bytes. Non-
// image files (PDFs, docs) skip compression entirely — see
// imageCompressor.js. Categories not listed here keep their original
// bytes, matching the "don't change the size for other attached
// files" spec.
const IMAGE_SIZE_CEILING = {
  profile_photo: 200 * 1024,
  cover_photo: 200 * 1024,
  firm_logo: 200 * 1024,
  // Case note + update attachments — pictures get re-encoded to fit
  // 300 KB; PDFs and docs go through untouched.
  case_note: 300 * 1024,
  booking_note: 300 * 1024,
  case_file: 300 * 1024,
};

// Map the existing upload categories (used by the /api/files API) onto
// the storage types the storageService understands. Both share the same
// vocabulary today, so this is mostly a passthrough — kept explicit so
// future category renames don't break URL prefixes.
const CATEGORY_TO_STORAGE_TYPE = {
  profile_photo: 'profile_photo',
  cover_photo: 'cover_photo',
  resume: 'resume',
  license_document: 'license_document',
  identity_document: 'identity_document',
  certification: 'certification',
  firm_logo: 'firm_logo',
  firm_registration: 'firm_registration',
  business_license: 'business_license',
  tax_document: 'tax_document',
  booking_note: 'booking_note',
  case_note: 'case_note',
  other: 'other',
};

const storageTypeFor = (category) =>
  CATEGORY_TO_STORAGE_TYPE[category] || 'other';

// The `uploads.originalName` column is `utf8` (utf8mb3) on the live DB,
// which MySQL refuses to populate with characters above U+007F unless
// the connection collation lines up exactly. Browsers + iOS Photos
// happily inject control bytes (U+0080) and macrons (U+00AF) into the
// filename, which would otherwise crash the INSERT with
//   "Incorrect string value: '\xC2\x80\xC2\xAF...' for column originalName".
// We strip control chars and force ASCII-friendly punctuation so the
// display string is safe to persist; the underlying byte content is
// untouched, and the server-generated UUID `storedName` is what every
// downstream lookup actually uses.
const safeOriginalName = (raw) => {
  if (raw === null || raw === undefined) return 'upload';
  const str = String(raw);
  // Drop any byte outside printable ASCII; collapse whitespace runs.
  let cleaned = '';
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (code >= 0x20 && code <= 0x7e) cleaned += ch;
    else cleaned += '_';
  }
  cleaned = cleaned.replace(/_{2,}/g, '_').trim();
  if (!cleaned) cleaned = 'upload';
  // Belt-and-braces length cap — the column is VARCHAR(255).
  return cleaned.length > 200 ? cleaned.slice(0, 200) : cleaned;
};

/**
 * Persist a memory-buffered multer file via storageService and create a
 * matching `uploads` row. Works in both local and S3 modes.
 *
 * @param {object} params
 * @param {string|null} params.userId   - owning user id (null for anon)
 * @param {string} params.category      - logical category bucket
 * @param {object} params.file          - multer memory file
 *   { buffer, mimetype, originalname, size }
 */
const createUpload = async ({ userId, category, caseId, bookingId, file }) => {
  const cleanOriginal = safeOriginalName(file.originalname);
  // Best-effort image compression before persistence. Non-image MIME
  // types pass through untouched (the helper short-circuits on
  // non-compressible types). When the ceiling is undefined no work is
  // attempted at all.
  const ceiling = IMAGE_SIZE_CEILING[category] || 0;
  const buffer = ceiling
    ? await compressToTargetBytes(file.buffer, file.mimetype, ceiling)
    : file.buffer;
  const persisted = await storageService.uploadFile({
    buffer,
    mimeType: file.mimetype,
    originalName: cleanOriginal,
    type: storageTypeFor(category),
    caseId: caseId || null,
    bookingId: bookingId || null,
  });
  const upload = await Upload.create({
    userId,
    category,
    originalName: cleanOriginal,
    storedName: persisted.storedName,
    mimeType: file.mimetype,
    size: persisted.size,
    // `url` carries the canonical stored path — `/uploads/<name>` for
    // local-driver rows, bare S3 key (e.g. `profile-images/<uuid>.jpg`)
    // for S3-driver rows. URL resolution on the client side is handled
    // by storageService.getFileUrl / the frontend resolveFileUrl helper.
    url: persisted.storedPath,
  });
  return upload;
};

/** Fetch a single upload by id. */
const getUploadById = async (id) => Upload.findByPk(id);

/** List all uploads owned by a user, newest first. */
const listUserUploads = async (userId) =>
  Upload.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
  });

/**
 * Delete an upload owned by the given user. Removes the database row
 * and the underlying object (local disk or S3) via storageService.
 */
const deleteUpload = async (id, userId) => {
  const upload = await Upload.findByPk(id);
  if (!upload || upload.userId !== userId) return false;
  try {
    await storageService.deleteFile(upload.url);
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      console.warn(
        `[fileService] storage delete failed for ${upload.url}: ${err.message}`
      );
    }
  }
  await upload.destroy();
  return true;
};

/**
 * Delete by storedPath, without owner-scoping or DB row removal. Used
 * when a caller has already removed the row (or the row never existed,
 * e.g. KYC docs stored directly on ProfessionalDetail) and just needs
 * the underlying object cleaned up.
 */
const deleteStoredPath = async (storedPath) => {
  if (!storedPath) return false;
  try {
    await storageService.deleteFile(storedPath);
    return true;
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      console.warn(
        `[fileService] deleteStoredPath failed for ${storedPath}: ${err.message}`
      );
    }
    return false;
  }
};

module.exports = {
  createUpload,
  getUploadById,
  listUserUploads,
  deleteUpload,
  deleteStoredPath,
};
