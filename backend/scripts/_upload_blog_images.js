// Upload the 5 family-law infographic PNGs from /tmp/blog_images/ to S3
// via the platform's storageService. Outputs a JSON map of
// { <slug>: <publicUrl> } that the SQL update step consumes.
//
// Usage:
//   node backend/scripts/_upload_blog_images.js
//
// Prints a final JSON line:
//   {"joint-debt":"https://…","bns-cruelty":"https://…", …}

const fs = require('fs');
const path = require('path');
const https = require('https');
const storageService = require('../src/services/storageService');

const SOURCE_DIR = '/tmp/blog_images';
const FILES = [
  { slug: 'joint-debt', file: 'joint-debt.png' },
  { slug: 'bns-cruelty', file: 'bns-cruelty.png' },
  { slug: 'grey-divorce', file: 'grey-divorce.png' },
  { slug: 'prenups', file: 'prenups.png' },
  { slug: 'alimony', file: 'alimony.png' },
];

function head(url) {
  return new Promise((resolve, reject) => {
    https
      .request(url, { method: 'HEAD' }, (res) =>
        resolve({ status: res.statusCode, ct: res.headers['content-type'] })
      )
      .on('error', reject)
      .end();
  });
}

(async () => {
  const driver = await storageService.getDriver();
  console.log('[blog-images] storage driver =', driver);
  if (driver !== 's3') {
    throw new Error(`Refusing to upload — storage driver is "${driver}", not "s3".`);
  }

  const result = {};
  for (const { slug, file } of FILES) {
    const p = path.join(SOURCE_DIR, file);
    const buffer = fs.readFileSync(p);
    console.log(`[blog-images] uploading ${slug} (${buffer.length} bytes)…`);
    const uploaded = await storageService.uploadFile({
      buffer,
      mimeType: 'image/png',
      originalName: file,
      type: 'blog_image',
    });
    const publicUrl = await storageService.getFileUrl(uploaded.key);
    const h = await head(publicUrl);
    console.log(`[blog-images]   key=${uploaded.key} ct=${h.ct} status=${h.status}`);
    result[slug] = publicUrl;
  }

  console.log('\n--- RESULT ---');
  console.log(JSON.stringify(result));
})().catch((err) => {
  console.error('[blog-images] failed:', err && err.message ? err.message : err);
  process.exit(1);
});
