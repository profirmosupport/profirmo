// geminiImageService — wraps Google's Generative Language API
// (gemini-2.5-flash-image / "Nano Banana") to generate a featured
// image from a text prompt. The blog flow uses this whenever
// gemini_api_key is configured; falls back to Unsplash search only
// when this fails.
//
// Endpoint shape (REST, no SDK so the service stays dep-free):
//   POST https://generativelanguage.googleapis.com/v1beta/
//        models/<model>:generateContent?key=<key>
//   body: { contents: [{ parts: [{ text: <prompt> }] }],
//           generationConfig: { responseModalities: ['IMAGE'] } }
//   response: { candidates: [{ content: { parts: [
//     { inlineData: { mimeType: 'image/png', data: '<base64>' } } ] } }] }

const adminSettings = require('./adminSettingsService');
const storageService = require('./storageService');

const ENDPOINT_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models';

async function getClient() {
  const [apiKey, model] = await Promise.all([
    adminSettings.getString('gemini_api_key'),
    adminSettings.getString('gemini_image_model'),
  ]);
  if (!apiKey) {
    throw {
      statusCode: 422,
      message:
        'Gemini API key not configured. Set gemini_api_key under Admin → AI / Anthropic.',
    };
  }
  return { apiKey, model: model || 'gemini-2.5-flash-image' };
}

// Build a rich image prompt from a blog post. Specific imagery beats
// abstract concepts for image models — we steer toward concrete legal
// scenes the model handles well.
function buildPromptFromPost({ title, excerpt }) {
  const hint = String(excerpt || '').slice(0, 240).trim();
  return [
    'High-quality editorial photograph for a legal-affairs blog header.',
    '16:9 wide aspect, soft natural light, professional newsroom feel.',
    'No text or watermarks in the image.',
    '',
    `Article title: ${title}`,
    hint ? `Brief: ${hint}` : '',
    '',
    'Subject guidance: depict the relevant Indian legal or regulatory ' +
      'scene — courtroom, statute book, gavel, Parliament steps, RBI ' +
      'or SEBI building, contract signing, professional in advocate ' +
      'attire, government office, etc. — whichever fits the topic. ' +
      'Avoid generic stock imagery and avoid showing real identifiable ' +
      'public figures.',
  ]
    .filter(Boolean)
    .join('\n');
}

// Hit the Generative Language API. Returns the first inlineData blob
// found in the response.
async function callGemini(prompt, { apiKey, model }) {
  // Auth via the `x-goog-api-key` header (rather than ?key=) — works
  // with both AIzaSy… AI Studio keys and newer AQ.Ab… key formats,
  // and keeps the key out of access logs that capture the URL.
  const url = `${ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    // NOTE: image-output models don't strictly need `responseModalities`
    // — they always emit inlineData parts. Setting it here was actually
    // rejected as a 400 on some account states, so we omit it and let
    // the model decide. Image models always emit images.
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const detail =
      (json.error && (json.error.message || json.error.status)) ||
      `HTTP ${resp.status}`;
    throw {
      statusCode: 502,
      message: `Gemini API error: ${detail}`,
    };
  }
  const cand = (json.candidates || [])[0];
  const parts = (cand && cand.content && cand.content.parts) || [];
  const imagePart = parts.find(
    (p) => p && p.inlineData && p.inlineData.data
  );
  if (!imagePart) {
    // Try the deprecated camelCase variant too, just in case.
    const alt = parts.find(
      (p) => p && p.inline_data && p.inline_data.data
    );
    if (!alt) {
      const finishReason = cand && (cand.finishReason || cand.finish_reason);
      throw {
        statusCode: 502,
        message:
          'Gemini did not return an image' +
          (finishReason ? ` (finishReason: ${finishReason})` : '') +
          '. The prompt may have been filtered by safety rules — try a different angle.',
      };
    }
    return {
      mimeType: alt.inline_data.mimeType || alt.inline_data.mime_type || 'image/png',
      base64: alt.inline_data.data,
    };
  }
  return {
    mimeType: imagePart.inlineData.mimeType || 'image/png',
    base64: imagePart.inlineData.data,
  };
}

function extToMime(mime) {
  switch (String(mime || '').toLowerCase()) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    default:
      return '.png';
  }
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Generate a featured image for a blog post via Gemini and upload it
 * to S3 (blog-images/ prefix). Returns the public URL + the prompt
 * the model was given (so callers can store it on the post / log it).
 *
 * @param {object} post - { title, excerpt }
 * @returns {Promise<{ url, prompt, mimeType, sizeBytes }>}
 */
async function generateAndStoreBlogImage({ title, excerpt }) {
  if (!title) {
    throw { statusCode: 422, message: 'Title is required to generate an image.' };
  }
  const { apiKey, model } = await getClient();
  const prompt = buildPromptFromPost({ title, excerpt });
  const { mimeType, base64 } = await callGemini(prompt, { apiKey, model });
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) {
    throw {
      statusCode: 502,
      message: 'Gemini returned an empty image payload.',
    };
  }
  const stored = await storageService.uploadFile({
    buffer,
    mimeType,
    originalName: `gemini-${slugify(title)}${extToMime(mimeType)}`,
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
