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

// Diffusion models read tag-style prompts much better than English
// paragraphs. We compose: SCENE (the post topic — most important,
// front-loaded) + STYLE tags (photography aesthetic the model
// reliably renders) + INDIA cues (so we don't get American
// courthouses). Negative prompt is passed as a separate URL param.
//
// Pick a concrete scene anchor from the title — diffusion does much
// better with a noun like "lawyer at desk" than the abstract concept
// "tax compliance". The map is shallow on purpose: it nudges the
// model toward an identifiable composition without overriding the
// title's specifics, which still get appended.
function pickSceneAnchor(title) {
  const t = String(title || '').toLowerCase();
  const check = (...words) => words.some((w) => t.includes(w));
  if (check('court', 'verdict', 'judgment', 'hearing', 'tribunal'))
    return 'Indian courtroom interior, wooden benches, ornate wood-panelled walls, soft natural daylight through tall windows';
  if (check('gst', 'tax ', ' tax', 'income tax', 'itr'))
    return 'tax documents and a calculator on a polished wood desk in an Indian advocate\'s chambers, ledgers stacked, fountain pen';
  if (check('rbi', 'reserve bank', 'monetary'))
    return 'classical sandstone facade of the Reserve Bank of India building in Mumbai at golden hour, columns, Indian tricolor';
  if (check('sebi', 'securities', 'capital market'))
    return 'modern glass office tower in BKC Mumbai, financial district at dusk, India';
  if (check('contract', 'agreement', 'mou', 'deed'))
    return 'fountain pen signing a printed legal contract on a leather desk pad, blurred bookshelf behind, warm light';
  if (check('parliament', 'lok sabha', 'rajya sabha', 'bill ', ' act '))
    return 'sandstone exterior of the Indian Parliament building in New Delhi, soft early morning light';
  if (check('supreme court'))
    return 'wide colonnade of the Supreme Court of India, New Delhi, soft daylight, no people in foreground';
  if (check('high court'))
    return 'colonial-era stone facade of an Indian High Court building, arched windows, warm afternoon light';
  if (check('property', 'real estate', 'rera', 'land'))
    return 'aerial view of residential apartments under construction in an Indian city, blueprints in foreground';
  if (check('startup', 'company', 'corporate', 'mca', 'directors'))
    return 'modern Indian corporate boardroom, dark wood table, leather chairs, city skyline through floor-to-ceiling windows';
  if (check('family', 'divorce', 'marriage', 'custody', 'maintenance'))
    return 'two folded hands resting on a stack of family-law statutes, soft window light, neutral background';
  if (check('intellectual property', 'patent', 'trademark', 'copyright', ' ip '))
    return 'magnifying glass on a patent diagram on a draftsman\'s desk, brass instruments, warm tungsten lamp';
  if (check('crypto', 'virtual digital', 'vda', 'bitcoin', 'web3'))
    return 'glowing circuit-board motif overlaid on the Indian rupee symbol, deep navy background, subtle neon accents';
  if (check('arbitrat', 'mediation', 'adr'))
    return 'two chairs across a long boardroom table, papers and water glasses, neutral lighting, calm tone';
  // Fallback — neutral, evocative, still clearly Indian-legal.
  return 'open law book and a brass gavel on a polished wood desk, an Indian advocate\'s chambers in the background, warm soft natural light';
}

// Tag-style prompt: scene first (front-loaded = highest weight on SD/
// flux/sana), then style + composition, then a one-line hook to the
// actual post title so different posts produce different images.
function buildPromptFromPost({ title, excerpt }) {
  const scene = pickSceneAnchor(title);
  const subject = String(title || '').trim().slice(0, 140);
  const hint = String(excerpt || '').trim().slice(0, 160);
  const tags = [
    scene,
    // editorial photo aesthetic
    'editorial photography',
    'documentary style',
    'cinematic composition',
    '16:9 wide framing',
    'shallow depth of field',
    'soft natural lighting',
    'warm color grading',
    'professional newsroom aesthetic',
    'high detail',
    'realistic photograph',
    'sharp focus',
    '4k',
    // contextual anchor
    `topic: ${subject}`,
    hint ? `context: ${hint}` : '',
  ].filter(Boolean);
  return tags.join(', ');
}

// Negative prompt — what we DON'T want. Passed as a separate URL
// param (Pollinations honours `negative_prompt`). Suppresses the
// failure modes we kept seeing: garbled text, fake watermarks,
// cartoonish styling, and impersonations of real political figures.
const NEGATIVE_PROMPT = [
  'text',
  'words',
  'letters',
  'captions',
  'subtitles',
  'watermark',
  'logo',
  'signature',
  'low quality',
  'blurry',
  'distorted',
  'deformed faces',
  'extra fingers',
  'ugly',
  'oversaturated',
  'cartoon',
  'anime',
  'illustration',
  'painting',
  'cgi',
  '3d render',
  'identifiable real people',
  'political figures',
  'celebrities',
  'nsfw',
].join(', ');

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
  const params = new URLSearchParams({
    width: String(w),
    height: String(h),
    nologo: 'true',
    enhance: 'true', // Pollinations' built-in prompt expander
    safe: 'true',
    seed: String(seed),
    negative_prompt: NEGATIVE_PROMPT,
  });
  const url = `${POLLINATIONS_BASE}/${path}?${params.toString()}`;

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
