// Upload middleware for the Profirmo backend.
//
// Multer is configured with MEMORY storage so the resulting buffer can be
// handed to storageService — which then decides whether to write it to
// local disk (driver=local) or push to AWS S3 (driver=s3). Keeping multer
// disk-free means flipping the storage driver from the admin panel takes
// effect immediately, with no fs side-effects when S3 is the target.
//
// `uploadSingle` accepts one file under the form field `file`.
// `handleUploadErrors` converts any multer error into a clean 400 JSON
// response so a bad upload never crashes the process.

const multer = require('multer');
const env = require('../config/env');
const { errorResponse } = require('../utils/responseHandler');

// Allowed MIME types -> canonical file extension used for the stored file.
const ALLOWED_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
};

const storage = multer.memoryStorage();

// Reject any file whose MIME type is not on the whitelist.
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES[file.mimetype]) {
    return cb(null, true);
  }
  const err = new Error(
    'Unsupported file type. Allowed types: JPEG, PNG, WEBP, GIF, PDF.'
  );
  err.code = 'UNSUPPORTED_FILE_TYPE';
  return cb(err, false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.maxUploadBytes },
});

// Configured single-file handler — expects the form field named `file`.
const uploadSingle = upload.single('file');

/**
 * Express error-handling middleware that turns a multer error (file too
 * large, wrong type, etc.) into a clean 400 JSON response. Mount this
 * immediately after the `uploadSingle` middleware on the upload route.
 */
// eslint-disable-next-line no-unused-vars
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    let message = 'File upload failed.';
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxMb = Math.round(env.maxUploadBytes / (1024 * 1024));
      message = `File too large. Maximum allowed size is ${maxMb} MB.`;
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field. Use the "file" field.';
    }
    return errorResponse(res, 400, message);
  }
  if (err && err.code === 'UNSUPPORTED_FILE_TYPE') {
    return errorResponse(res, 400, err.message);
  }
  if (err) {
    return errorResponse(res, 400, err.message || 'File upload failed.');
  }
  return next();
};

module.exports = {
  uploadSingle,
  handleUploadErrors,
  ALLOWED_MIME_TYPES,
};
