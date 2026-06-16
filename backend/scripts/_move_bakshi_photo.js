// Download a lawrato-hosted profile photo, upload to S3 via the backend's
// existing storageService (same auth + naming convention as every other
// profile photo on the platform), and return the new key + public URL so
// the caller can update the DB row.
//
// Usage:
//   node scripts/_move_bakshi_photo.js \
//     [SOURCE_URL]                       (default: Sunil Kumar Bakshi)
//     [ORPHAN_KEY_TO_DELETE_FIRST]
//     [--mime=image/jpeg|image/webp]     (default: image/webp)

const https = require('https');
const storageService = require('../src/services/storageService');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = process.argv
  .filter((a) => a.startsWith('--'))
  .reduce((acc, a) => {
    const [k, v] = a.slice(2).split('=');
    acc[k] = v == null ? true : v;
    return acc;
  }, {});

const SOURCE_URL =
  args[0] ||
  'https://lawrato.com/expert_images/thumb/webp/advocate-sunil-kumar-bakshi.webp';
const ORPHAN_KEY = args[1] || null;
const MIME = flags.mime || 'image/webp';
const EXT_FROM_MIME = MIME === 'image/jpeg' ? '.jpg' : '.webp';
const ORIGINAL_NAME = SOURCE_URL.split('/').pop() || `profile${EXT_FROM_MIME}`;

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            // Lawrato 403s requests with no UA / curl UA.
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36',
            Accept: 'image/webp,image/*,*/*;q=0.8',
            Referer: 'https://lawrato.com/',
          },
        },
        (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            return fetchBuffer(res.headers.location).then(resolve, reject);
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode}`));
          }
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () =>
            resolve({
              buffer: Buffer.concat(chunks),
              contentType:
                res.headers['content-type'] || 'application/octet-stream',
            })
          );
        }
      )
      .on('error', reject);
  });
}

(async () => {
  const driver = await storageService.getDriver();
  console.log('[move] storage driver =', driver);
  if (driver !== 's3') {
    throw new Error(`Refusing to upload — storage driver is "${driver}", not "s3".`);
  }

  if (ORPHAN_KEY) {
    console.log('[move] deleting orphan key:', ORPHAN_KEY);
    await storageService.deleteFile(ORPHAN_KEY);
  }

  console.log('[move] fetching', SOURCE_URL);
  const { buffer } = await fetchBuffer(SOURCE_URL);
  console.log('[move] downloaded', buffer.length, 'bytes');

  // Force the explicit image/* MIME — lawrato's CDN returns
  // application/octet-stream and we want S3 to serve a real image
  // Content-Type so browsers render inline.
  const result = await storageService.uploadFile({
    buffer,
    mimeType: MIME,
    originalName: ORIGINAL_NAME,
    type: 'profile_photo',
  });
  console.log('[move] uploaded:', JSON.stringify(result));

  const publicUrl = await storageService.getFileUrl(result.key);
  console.log('[move] public URL:', publicUrl);

  // Verify via a HEAD request so we know the object is actually readable.
  const head = await new Promise((resolve, reject) => {
    https
      .request(publicUrl, { method: 'HEAD' }, (res) =>
        resolve({ status: res.statusCode, ct: res.headers['content-type'] })
      )
      .on('error', reject)
      .end();
  });
  console.log('[move] HEAD on public URL:', head);

  console.log(
    JSON.stringify({ key: result.key, publicUrl, size: result.size })
  );
})().catch((err) => {
  console.error('[move] failed:', err && err.message ? err.message : err);
  process.exit(1);
});
