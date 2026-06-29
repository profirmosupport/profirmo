// pollinationsImageService — free AI image generation via
// pollinations.ai. No API key, no signup, no rate-limit headers; the
// service hits a URL with the URL-encoded prompt and gets a JPEG
// back. Used as the sole image source for the AI blog flow (both the
// daily cron and the per-post "Generate with AI" button).
//
// Endpoint shape:
//   GET https://image.pollinations.ai/prompt/<url-encoded prompt>
//       ?width=1280&height=720&nologo=true
//   → 200 OK, content-type: image/jpeg, body = raw JPEG bytes

const https = require('https');
const storageService = require('./storageService');

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const REQUEST_TIMEOUT_MS = 60 * 1000; // image gen can take ~10-30s

// Build a rich prompt from a blog post. Concrete imagery beats
// abstract concepts on diffusion models — steer toward identifiable
// Indian legal scenes the model can render well, and forbid text in
// the image (image models routinely produce garbled letters).
function buildPromptFromPost({ title, excerpt }) {
  const hint = String(excerpt || '').slice(0, 220).trim();
  return [
    'High-quality editorial photograph for the header of a legal-affairs blog.',
    '16:9 wide aspect, soft natural light, professional newsroom feel.',
    'Subject: an Indian legal or regulatory scene appropriate to the topic — courtroom, statute book, gavel, contract on a desk, Parliament steps, RBI / SEBI building, professional in advocate attire, government office. Avoid generic stock imagery.',
    'No text, no captions, no watermarks anywhere in the image.',
    'Do not include identifiable real people or political figures.',
    '',
    `Article title: ${title}`,
    hint ? `Brief: ${hint}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'Profirmo-AI-Blog/1.0 (+https://profirmo.com)',
          accept: 'image/*',
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (resp) => {
        // Pollinations occasionally 30x's during high load.
        if (
          resp.statusCode &&
          resp.statusCode >= 300 &&
          resp.statusCode < 400 &&
          resp.headers.location
        ) {
          downloadImage(resp.headers.location).then(resolve, reject);
          return;
        }
        if (!resp.statusCode || resp.statusCode >= 400) {
          reject(
            new Error(
              `Pollinations HTTP ${resp.statusCode} — model may be overloaded, retry in a few seconds.`
            )
          );
          resp.resume();
          return;
        }
        const ct = (resp.headers['content-type'] || '').toLowerCase();
        if (!ct.startsWith('image/')) {
          reject(
            new Error(
              `Pollinations returned non-image content-type "${ct}". Body likely an error page.`
            )
          );
          resp.resume();
          return;
        }
        const chunks = [];
        resp.on('data', (c) => chunks.push(c));
        resp.on('end', () =>
          resolve({
            buffer: Buffer.concat(chunks),
            mimeType: ct.split(';')[0] || 'image/jpeg',
          })
        );
        resp.on('error', reject);
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error('Pollinations request timed out.'));
    });
    req.on('error', reject);
  });
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function extForMime(mime) {
  switch (String(mime || '').toLowerCase()) {
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/jpeg':
    case 'image/jpg':
    default:
      return '.jpg';
  }
}

/**
 * Generate a featured image for a blog post and upload it to S3.
 * Returns the public URL + the prompt that was used (handy for audit
 * logging and "regenerate again" flows).
 *
 * @param {object} args
 * @param {string} args.title    — blog post title (required)
 * @param {string} [args.excerpt] — short summary for richer prompts
 * @param {number} [args.width]   — defaults to 1280
 * @param {number} [args.height]  — defaults to 720
 * @returns {Promise<{url, prompt, mimeType, sizeBytes}>}
 */
async function generateAndStoreBlogImage({ title, excerpt, width, height } = {}) {
  if (!title) {
    throw {
      statusCode: 422,
      message: 'Title is required to generate an image.',
    };
  }
  const w = Number(width) || DEFAULT_WIDTH;
  const h = Number(height) || DEFAULT_HEIGHT;
  const prompt = buildPromptFromPost({ title, excerpt });
  // Encode the prompt as a URL path segment. encodeURIComponent
  // handles slashes, newlines, quotes and so on; we also strip any
  // leading slash so the path doesn't accidentally double-segment.
  const path = encodeURIComponent(prompt).replace(/^%2F/, '');
  // Adding a small seed query keeps the same prompt deterministic
  // across retries; we randomise per call via Date.now() (no
  // Math.random() so the function stays cheap and predictable to
  // log).
  const seed = Date.now() % 1000000;
  const url =
    `${POLLINATIONS_BASE}/${path}` +
    `?width=${w}&height=${h}&nologo=true&seed=${seed}`;

  const { buffer, mimeType } = await downloadImage(url);
  if (!buffer || buffer.length === 0) {
    throw {
      statusCode: 502,
      message: 'Pollinations returned an empty body.',
    };
  }
  const stored = await storageService.uploadFile({
    buffer,
    mimeType,
    originalName: `pollinations-${slugify(title)}${extForMime(mimeType)}`,
    type: 'blog_image',
  });
  const cfg = await storageService.getPublicConfig();
  const publicUrl =
    cfg.driver === 's3' && cfg.baseUrl
      ? `${cfg.baseUrl.replace(/\/$/, '')}/${stored.key}`
      : `/uploads/${stored.storedName}`;
  return {
    url: publicUrl,
    prompt,
    mimeType,
    sizeBytes: buffer.length,
  };
}

module.exports = {
  generateAndStoreBlogImage,
  buildPromptFromPost,
};
