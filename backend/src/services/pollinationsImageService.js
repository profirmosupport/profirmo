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
const sharp = require('sharp');
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
  if (check('cyber', 'data protection', 'dpdp', 'privacy', 'digital personal'))
    return 'a glowing padlock motif overlaid on Indian map outlines, deep blue backdrop, subtle circuit traces, professional editorial style';
  if (check('parliament', 'lok sabha', 'rajya sabha', 'bill passed', 'bill introduced', 'new law'))
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
  if (check(' ev ', 'electric vehicle', 'e-vehicle', 'evs ', 'mobility', 'transport policy'))
    return 'a modern electric vehicle parked outside a sleek Indian government office building, charging station in view, soft daylight';
  if (check('environment', 'pollution', 'emission', 'climate', 'green '))
    return 'wide aerial view of a green city skyline in India, soft haze, tree-lined avenues, calm morning light';
  if (check('labour', 'labor', 'employment', 'wage', 'employee'))
    return 'an office floor in an Indian corporate building, rows of desks softly out of focus, foreground a printed labour-law statute book';
  if (check('consumer', 'cci', 'competition'))
    return 'a marketplace scene in an Indian city with shops in soft focus and a consumer-rights pamphlet in the foreground, warm light';
  // Fallback — neutral, evocative, still clearly Indian-legal.
  return 'open law book and a brass gavel on a polished wood desk, an Indian advocate\'s chambers in the background, warm soft natural light';
}

// Trim a string to a word boundary so the rendered headline never
// ends mid-word ("businesse" instead of "businesses"). Returns the
// original if it's already under the limit.
function truncateAtWord(s, maxLen) {
  const str = String(s || '');
  if (str.length <= maxLen) return str;
  const cut = str.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut;
}

// Tag-style prompt: scene first (front-loaded = highest weight on
// SD/flux/sana), then a clean style block. We DO NOT ask the model
// to render any text — sana/flux on the free tier render garbled
// gibberish for arbitrary headlines. Instead the picture is
// scene-only and we composite the "Profirmo: <title>" overlay
// server-side via sharp + SVG (see addHeadlineOverlay below) so the
// rendered text is pixel-perfect.
function buildPromptFromPost({ title, excerpt }) {
  const subject = String(title || '').trim().slice(0, 140);
  const hint = String(excerpt || '').trim().slice(0, 160);
  const scene = pickSceneAnchor(subject);
  const tags = [
    // SCENE (highest weight — drives the actual picture)
    scene,
    // PHOTOGRAPHIC STYLE
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
    'no text in image',
    'no watermarks',
    // contextual anchor — keeps imagery on-topic across posts that
    // share the same scene anchor
    `topic: ${subject}`,
    hint ? `context: ${hint}` : '',
  ].filter(Boolean);
  return tags.join(', ');
}

// Negative prompt — Pollinations passes this as a separate URL
// param. Suppress text rendering hard (we add our own afterwards),
// plus the usual diffusion failure modes.
const NEGATIVE_PROMPT = [
  'text',
  'words',
  'letters',
  'captions',
  'subtitles',
  'watermark',
  'logo',
  'signature',
  'typography',
  'lettering',
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

// --- Title overlay via sharp + SVG ---------------------------------
//
// Renders "Profirmo: <Title>" on the bottom of the generated image
// as a magazine-cover headline. The text is drawn from an SVG layer
// (pixel-perfect, kerned by the SVG renderer) over a dark gradient
// band that fades up from the bottom. Wraps up to 2 lines; falls
// back to a single ellipsised line if the title is unusually long.

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Word-wrap into at most `maxLines` lines, each up to ~`maxChars`
// chars. If the text overflows, the last line is ellipsised.
function wrapHeadline(text, maxChars, maxLines = 2) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > maxChars && line) {
      lines.push(line);
      if (lines.length >= maxLines) {
        // truncate remaining words into ellipsis
        lines[maxLines - 1] = lines[maxLines - 1].replace(/[.,;:!?\s]*$/, '') + '…';
        return lines;
      }
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  // If the final line itself is still over the cap, hard-truncate.
  if (lines.length && lines[lines.length - 1].length > maxChars + 4) {
    lines[lines.length - 1] = lines[lines.length - 1].slice(0, maxChars) + '…';
  }
  return lines.slice(0, maxLines);
}

function buildHeadlineSvg({ title, width, height }) {
  const headline = `Profirmo: ${String(title || '').trim()}`;
  // Picked by squinting at sample renders — these ratios keep the
  // text readable on 1024-2048 px wide cards without runtime
  // measurement (sharp can't measure SVG text without rendering).
  const fontSize = Math.round(width / 26); // ~39px at 1024 wide
  const padX = Math.round(width * 0.05);
  const maxChars = Math.floor((width - padX * 2) / (fontSize * 0.52));
  const lines = wrapHeadline(headline, maxChars, 2);
  const finalFontSize = lines.length > 1 ? Math.round(fontSize * 0.92) : fontSize;
  const lineHeight = Math.round(finalFontSize * 1.18);
  const totalTextH = lines.length * lineHeight;
  const bandH = Math.round(height * 0.36);
  const bandY = height - bandH;
  // Vertically centre the text within the band.
  const firstBaseline = bandY + Math.round((bandH - totalTextH) / 2) + finalFontSize;
  const textNodes = lines
    .map(
      (line, i) =>
        `<text x="${padX}" y="${firstBaseline + i * lineHeight}" ` +
        `font-family="'Helvetica Neue','Inter',Arial,sans-serif" ` +
        `font-size="${finalFontSize}" font-weight="800" fill="white" ` +
        `style="paint-order:stroke;stroke:rgba(0,0,0,0.65);stroke-width:2.5px;letter-spacing:0.2px">` +
        `${escapeXml(line)}</text>`
    )
    .join('');
  return Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<defs>` +
      `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="rgba(0,0,0,0)"/>` +
      `<stop offset="0.45" stop-color="rgba(0,0,0,0.45)"/>` +
      `<stop offset="1" stop-color="rgba(0,0,0,0.88)"/>` +
      `</linearGradient>` +
      `</defs>` +
      `<rect x="0" y="${bandY}" width="${width}" height="${bandH}" fill="url(#g)"/>` +
      textNodes +
      `</svg>`
  );
}

async function addHeadlineOverlay(buffer, title) {
  const meta = await sharp(buffer).metadata();
  const width = meta.width || 1280;
  const height = meta.height || 720;
  const svg = buildHeadlineSvg({ title, width, height });
  return sharp(buffer)
    .composite([{ input: svg, top: 0, left: 0 }])
    .jpeg({ quality: 88, progressive: true })
    .toBuffer();
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

  const { buffer: rawBuffer, mimeType: rawMime } = await downloadImage(url);
  if (!rawBuffer || rawBuffer.length === 0) {
    throw {
      statusCode: 502,
      message: 'Pollinations returned an empty body.',
    };
  }
  // Composite the "Profirmo: <title>" headline via sharp + SVG so
  // the rendered text is pixel-perfect. Falls back to the raw
  // Pollinations bytes if sharp choked on the input (rare).
  let buffer = rawBuffer;
  let mimeType = rawMime;
  try {
    buffer = await addHeadlineOverlay(rawBuffer, title);
    mimeType = 'image/jpeg';
  } catch (err) {
    console.warn(
      '[pollinations] sharp overlay failed; using raw image:',
      err.message
    );
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
