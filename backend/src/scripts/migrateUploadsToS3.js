// migrateUploadsToS3 — one-shot migration that copies every legacy
// `/uploads/<file>` row to its proper S3 prefix and rewrites the DB
// path to the bare key. Idempotent: rows already pointing at a bare key
// (or an absolute URL) are skipped.
//
// Usage (from backend/):
//   node src/scripts/migrateUploadsToS3.js              # dry run
//   node src/scripts/migrateUploadsToS3.js --apply      # do it
//   node src/scripts/migrateUploadsToS3.js --apply --delete-local
//     -> also unlink the local file after a successful S3 upload
//
// Requires the admin settings to already have storage_driver=s3 and
// valid AWS credentials. The script does NOT flip the driver itself —
// the admin should switch only after the migration is complete.

const fs = require('fs');
const path = require('path');
const sequelize = require('../config/database');
const env = require('../config/env');
const { Upload } = require('../models');
const storageService = require('../services/storageService');

const APPLY = process.argv.includes('--apply');
const DELETE_LOCAL = process.argv.includes('--delete-local');

async function migrateOne(row) {
  const localPath = String(row.url || '');
  if (!localPath.startsWith('/uploads/')) {
    return { skipped: 'not-local', row };
  }
  const fileName = localPath.replace(/^\/uploads\//, '');
  const diskPath = path.join(env.uploadsDir, fileName);
  let buffer;
  try {
    buffer = await fs.promises.readFile(diskPath);
  } catch (err) {
    return { skipped: `missing-file (${err.code})`, row };
  }

  const prefix = storageService.prefixFor(row.category);
  const newKey = `${prefix}${fileName}`;

  if (!APPLY) {
    return { dryRun: true, from: localPath, to: newKey, bytes: buffer.length };
  }

  const persisted = await storageService.uploadFile({
    buffer,
    mimeType: row.mimeType || 'application/octet-stream',
    originalName: row.originalName || fileName,
    type: row.category || 'other',
  });

  await row.update({ url: persisted.storedPath, storedName: persisted.storedName });

  if (DELETE_LOCAL) {
    try {
      await fs.promises.unlink(diskPath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn(`[migrate] unlink failed for ${diskPath}: ${err.message}`);
      }
    }
  }

  return { migrated: true, from: localPath, to: persisted.storedPath };
}

(async () => {
  console.log(
    `[migrate] mode=${APPLY ? 'APPLY' : 'dry-run'}${DELETE_LOCAL ? ' delete-local=yes' : ''}`
  );
  const driver = await storageService.getDriver();
  if (driver !== 's3') {
    console.error(
      '[migrate] Active storage driver is not "s3" — set it in Admin > Storage settings before running this script. Aborting.'
    );
    process.exit(1);
  }

  const rows = await Upload.findAll({
    where: {},
    order: [['createdAt', 'ASC']],
  });

  let processed = 0;
  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  const skippedReasons = {};

  for (const row of rows) {
    processed += 1;
    try {
      const result = await migrateOne(row);
      if (result.migrated) migrated += 1;
      else if (result.dryRun) {
        migrated += 1;
        console.log(
          `[dry-run] ${result.from} -> ${result.to} (${result.bytes} bytes)`
        );
      } else if (result.skipped) {
        skipped += 1;
        skippedReasons[result.skipped] =
          (skippedReasons[result.skipped] || 0) + 1;
      }
    } catch (err) {
      failed += 1;
      console.warn(
        `[migrate] failed for upload ${row.id} (${row.url}): ${err.message}`
      );
    }
  }

  console.log(
    `[migrate] done — processed=${processed} migrated=${migrated} skipped=${skipped} failed=${failed}`
  );
  if (Object.keys(skippedReasons).length > 0) {
    console.log('[migrate] skip reasons:', skippedReasons);
  }
  await sequelize.close();
  process.exit(failed > 0 ? 1 : 0);
})().catch(async (err) => {
  console.error('[migrate] fatal:', err);
  await sequelize.close().catch(() => {});
  process.exit(2);
});
