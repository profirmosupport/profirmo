// storageService — abstracts file persistence so the rest of the
// codebase doesn't care whether the active driver is local disk or AWS
// S3. The active driver + S3 credentials live in admin_settings (keys:
// `storage_driver`, `aws_access_key_id`, …) and can be flipped from the
// admin panel without restarting the server.
//
// Exposed surface:
//   uploadFile({ buffer, mimeType, originalName, type })
//   deleteFile(storedPath)
//   getFileUrl(storedPath)
//   getTemporaryFileUrl(storedPath, expiryMinutes)
//   testConnection()              -> put + delete in temp/ on S3
//   getDriver()                   -> 'local' | 's3'
//   getPublicConfig()             -> { driver, baseUrl }   (safe for clients)
//   prefixFor(type)               -> S3 prefix string ending in '/'
//
// Stored path convention:
//   * Local driver  -> `/uploads/<filename>` (back-compat with pre-S3
//                     rows). The file lives at <env.uploadsDir>/<filename>.
//   * S3 driver     -> `<prefix><filename>`  (bare key, e.g.
//                     `profile-images/<uuid>.jpg`).
// The driver is recorded in the path shape itself so URL resolution works
// even after the admin flips the driver — old `/uploads/*` files keep
// resolving via the backend, new bare keys resolve via S3 / CDN.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const adminSettings = require('./adminSettingsService');
const env = require('../config/env');

// ---------------------------------------------------------------------------
// Type → S3 prefix mapping. Keep this in sync with the admin spec.
// Every prefix ends with `/`.
// ---------------------------------------------------------------------------
const TYPE_TO_PREFIX = {
  // Public-facing
  profile_photo: 'profile-images/',
  cover_photo: 'profile-images/',
  firm_logo: 'company-logos/',
  banner: 'banners/',
  blog_image: 'blog-images/',
  category_icon: 'category-icons/',
  user_image: 'users/',
  // Private
  resume: 'documents/',
  license_document: 'documents/',
  identity_document: 'documents/',
  certification: 'documents/',
  business_license: 'documents/',
  tax_document: 'documents/',
  firm_registration: 'documents/',
  document: 'documents/',
  // Booking-note attachments land under their own bucket so the upload
  // doesn't require a case. When the booking later converts to a case,
  // attachments are referenced by URL from the migrated CaseNote rows.
  booking_note: 'booking-files/',
  case_note: 'case-files/',
  case_file: 'case-files/',
  invoice: 'invoices/',
  temp: 'temp/',
  // Everything else goes under users/ as a generic bucket for user-owned
  // artifacts that don't fit a named slot.
  other: 'users/',
};

// Prefixes whose objects should be served via presigned URLs (private).
const PRIVATE_PREFIXES = new Set([
  'case-files/',
  'booking-files/',
  'documents/',
  'invoices/',
  'temp/',
]);

// MIME → extension. Mirrors the upload middleware whitelist.
const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
};

function prefixFor(type) {
  return TYPE_TO_PREFIX[type] || TYPE_TO_PREFIX.other;
}

// Case-scoped slug sanitiser. Case ids are server-generated (`case-…`)
// but we hard-clamp anyway so a hostile caller can't smuggle path
// segments via the caseId field. Strips slashes, dots and anything
// outside `[A-Za-z0-9_-]` so `../escape` and `..foo` both collapse to
// flat alphanumerics. Result capped to 80 chars.
function safeCaseSegment(caseId) {
  return String(caseId || '')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 80);
}

const CASE_PREFIXED_TYPES = new Set(['case_note', 'case_file']);

// Booking-note uploads get their own per-booking folder so leaked
// keys can't reveal another booking's attachments. Authorisation
// against the booking happens in the file controller before the
// upload is persisted.
const BOOKING_PREFIXED_TYPES = new Set(['booking_note']);

const SCOPED_TYPES = new Set([...CASE_PREFIXED_TYPES, ...BOOKING_PREFIXED_TYPES]);

/**
 * Build the storage key prefix for a given upload, optionally nested
 * inside a per-scope sub-folder (case or booking). For non-scoped
 * types, `scopeId` is ignored. For scoped types with a scopeId,
 * returns `<base>/<scopeId>/`.
 */
function prefixForUpload(type, scopeId) {
  const base = prefixFor(type);
  if (scopeId && SCOPED_TYPES.has(type)) {
    const seg = safeCaseSegment(scopeId);
    if (seg) return `${base}${seg}/`;
  }
  return base;
}

function isPrivateKey(key) {
  if (!key) return false;
  for (const p of PRIVATE_PREFIXES) {
    if (key.startsWith(p)) return true;
  }
  return false;
}

function inferExtension(mimeType, originalName) {
  if (MIME_TO_EXT[mimeType]) return MIME_TO_EXT[mimeType];
  const fromName = String(originalName || '').match(/\.[A-Za-z0-9]{1,8}$/);
  return fromName ? fromName[0].toLowerCase() : '';
}

// ---------------------------------------------------------------------------
// Config loader. Reads admin_settings on every call so live updates from
// the admin panel take effect without a server restart.
// ---------------------------------------------------------------------------
async function loadConfig() {
  const driver = (await adminSettings.getString('storage_driver')) || 'local';
  if (driver !== 's3') return { driver: 'local' };
  return {
    driver: 's3',
    accessKeyId: await adminSettings.getString('aws_access_key_id'),
    secretAccessKey: await adminSettings.getString('aws_secret_access_key'),
    region:
      (await adminSettings.getString('aws_default_region')) || 'ap-south-1',
    bucket: (await adminSettings.getString('aws_bucket')) || '',
    baseUrl: (await adminSettings.getString('aws_url')) || '',
    usePathStyle:
      (await adminSettings.getString('aws_use_path_style_endpoint')) ===
      'true',
  };
}

async function getDriver() {
  const cfg = await loadConfig();
  return cfg.driver;
}

/** Public-safe config — what the browser/mobile need to build URLs. */
async function getPublicConfig() {
  const cfg = await loadConfig();
  if (cfg.driver !== 's3') return { driver: 'local', baseUrl: '' };
  const baseUrl =
    cfg.baseUrl || `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com`;
  return { driver: 's3', baseUrl };
}

// ---------------------------------------------------------------------------
// S3 client cache. Re-created whenever the cached credentials drift from
// the stored ones, so the admin can rotate keys without bouncing the
// process.
// ---------------------------------------------------------------------------
let cachedClient = null;
let cachedClientKey = '';

async function getS3Client(cfgArg) {
  const cfg = cfgArg || (await loadConfig());
  if (cfg.driver !== 's3') {
    throw {
      statusCode: 503,
      message:
        'Storage driver is not configured for S3. Switch to S3 in Admin > Storage settings.',
    };
  }
  if (!cfg.accessKeyId || !cfg.secretAccessKey) {
    throw {
      statusCode: 503,
      message:
        'AWS credentials are missing. Set Access Key ID + Secret in Admin > Storage settings.',
    };
  }
  const cacheKey = `${cfg.region}|${cfg.accessKeyId}|${cfg.secretAccessKey.length}|${cfg.usePathStyle}`;
  if (cachedClient && cachedClientKey === cacheKey) return cachedClient;
  // eslint-disable-next-line global-require
  const { S3Client } = require('@aws-sdk/client-s3');
  cachedClient = new S3Client({
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    forcePathStyle: !!cfg.usePathStyle,
  });
  cachedClientKey = cacheKey;
  return cachedClient;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------
/**
 * Persist a file buffer to the active storage driver.
 *
 * @param {object} args
 * @param {Buffer} args.buffer      - the file bytes
 * @param {string} args.mimeType    - validated MIME type
 * @param {string} args.originalName- client-supplied filename (only used for ext fallback)
 * @param {string} args.type        - logical type from TYPE_TO_PREFIX (eg `profile_photo`)
 * @returns {Promise<{storedPath: string, key: string, prefix: string, size: number, mimeType: string, storedName: string, driver: string}>}
 */
async function uploadFile({
  buffer,
  mimeType,
  originalName,
  type,
  // Either a caseId (case_note, case_file) or a bookingId (booking_note).
  // Both ids are sanitised through the same alphanumeric regex.
  caseId,
  bookingId,
}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw { statusCode: 400, message: 'No file content to upload.' };
  }
  if (!mimeType) {
    throw { statusCode: 400, message: 'mimeType is required.' };
  }
  const scopeId = BOOKING_PREFIXED_TYPES.has(type) ? bookingId : caseId;
  const prefix = prefixForUpload(type, scopeId);
  const ext = inferExtension(mimeType, originalName);
  const storedName = `${crypto.randomUUID()}${ext}`;
  const key = `${prefix}${storedName}`;
  const cfg = await loadConfig();

  if (cfg.driver === 's3') {
    // eslint-disable-next-line global-require
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const client = await getS3Client(cfg);
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        // Public-prefix objects are readable via the CDN base URL —
        // ACLs are optional (many buckets disable them; the bucket
        // policy handles read instead) so we don't set them here.
      })
    );
    return {
      storedPath: key,
      key,
      prefix,
      size: buffer.length,
      mimeType,
      storedName,
      driver: 's3',
    };
  }

  // Local driver: write to env.uploadsDir, mirroring the S3 prefix as a
  // sub-directory so directory listings match the cloud layout.
  const localPath = path.join(env.uploadsDir, prefix.replace(/\/$/, ''));
  await fs.promises.mkdir(localPath, { recursive: true });
  await fs.promises.writeFile(path.join(localPath, storedName), buffer);
  // Backwards-compatible stored shape for existing /uploads static serving.
  // Older code expects `/uploads/<storedName>` (no sub-directory), so we
  // ALSO drop a hardlink at the flat path. Falls back to a copy on
  // filesystems where hardlinks are not supported.
  const flatPath = path.join(env.uploadsDir, storedName);
  try {
    await fs.promises.link(path.join(localPath, storedName), flatPath);
  } catch {
    try {
      await fs.promises.copyFile(
        path.join(localPath, storedName),
        flatPath
      );
    } catch {
      /* both forms failed — flat URL won't resolve, but prefixed will */
    }
  }
  return {
    storedPath: `/uploads/${storedName}`,
    key,
    prefix,
    size: buffer.length,
    mimeType,
    storedName,
    driver: 'local',
  };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
async function deleteFile(storedPath) {
  if (!storedPath) return false;
  const cfg = await loadConfig();
  const s = String(storedPath);

  // Legacy `/uploads/<name>` rows ALWAYS resolve against local disk —
  // they were written before S3 existed in this codebase and would not
  // exist in the bucket.
  if (s.startsWith('/uploads/')) {
    const rel = s.replace(/^\/uploads\//, '');
    const fullPath = path.join(env.uploadsDir, rel);
    try {
      await fs.promises.unlink(fullPath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    return true;
  }

  if (cfg.driver === 's3') {
    // eslint-disable-next-line global-require
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const client = await getS3Client(cfg);
    await client.send(
      new DeleteObjectCommand({ Bucket: cfg.bucket, Key: s })
    );
    return true;
  }

  // Local driver, bare key — file lives in <uploadsDir>/<prefix>/<name>.
  const fullPath = path.join(env.uploadsDir, s);
  try {
    await fs.promises.unlink(fullPath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return true;
}

// ---------------------------------------------------------------------------
// URL resolution
// ---------------------------------------------------------------------------
/**
 * Build an absolute URL for a stored path. Private S3 keys are returned
 * as presigned URLs (15 min default). Absolute http(s) inputs pass
 * through unchanged. Legacy `/uploads/*` paths are left relative so the
 * client side prepends API_BASE_URL the same way it always has.
 */
async function getFileUrl(storedPath, opts = {}) {
  if (!storedPath) return '';
  const s = String(storedPath);
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/uploads/')) return s; // resolved client-side
  // Bare key. Need to know the driver.
  const cfg = await loadConfig();
  if (cfg.driver !== 's3') return `/uploads/${s}`;
  if (isPrivateKey(s)) {
    return getTemporaryFileUrl(s, opts.expiryMinutes || 15);
  }
  const base = (
    cfg.baseUrl || `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com`
  ).replace(/\/$/, '');
  return `${base}/${s}`;
}

async function getTemporaryFileUrl(storedPath, expiryMinutes = 15) {
  if (!storedPath) return '';
  const s = String(storedPath);
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/uploads/')) return s;
  const cfg = await loadConfig();
  if (cfg.driver !== 's3') return `/uploads/${s}`;
  // eslint-disable-next-line global-require
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  // eslint-disable-next-line global-require
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  const client = await getS3Client(cfg);
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: cfg.bucket, Key: s }),
    { expiresIn: Math.max(60, Math.floor(expiryMinutes * 60)) }
  );
}

// ---------------------------------------------------------------------------
// Connectivity test — puts a tiny text file in temp/ then deletes it.
// ---------------------------------------------------------------------------
async function testConnection() {
  const cfg = await loadConfig();
  if (cfg.driver !== 's3') {
    throw {
      statusCode: 400,
      message:
        'Storage driver is set to "local" — switch to "s3" before testing.',
    };
  }
  if (!cfg.bucket) {
    throw {
      statusCode: 400,
      message: 'AWS bucket name is empty. Set it under Admin > Storage.',
    };
  }
  // eslint-disable-next-line global-require
  const {
    PutObjectCommand,
    DeleteObjectCommand,
  } = require('@aws-sdk/client-s3');
  const client = await getS3Client(cfg);
  const key = `temp/connection-test-${Date.now()}.txt`;
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: Buffer.from('Profirmo S3 connectivity test'),
      ContentType: 'text/plain',
    })
  );
  await client.send(
    new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key })
  );
  return {
    ok: true,
    bucket: cfg.bucket,
    region: cfg.region,
    testKey: key,
  };
}

module.exports = {
  uploadFile,
  deleteFile,
  getFileUrl,
  getTemporaryFileUrl,
  testConnection,
  getDriver,
  getPublicConfig,
  prefixFor,
  prefixForUpload,
  isPrivateKey,
  safeCaseSegment,
  TYPE_TO_PREFIX,
  CASE_PREFIXED_TYPES,
};
