// imageCompressor — best-effort server-side downsize for uploaded
// images so storage + bandwidth stay bounded. Non-image MIME types
// pass through untouched.
//
// Strategy: re-encode in the original format with progressively lower
// quality + dimensions until the result fits the requested ceiling.
// We never UPSIZE — if the input is already smaller than the ceiling,
// it's returned verbatim.
//
// Format support: JPEG, PNG, WebP. GIFs are passed through (sharp can
// flatten animated GIFs but losing the animation is rarely the desired
// behaviour for a profile / note image).

const sharp = require('sharp');

const COMPRESSIBLE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

// Quality + max-dimension sweep. We start large + high quality and drop
// both knobs together until the bytes fit. Five steps is enough to take
// a 6 MB phone photo down to ~150 KB.
const STEPS = [
  { quality: 82, maxDim: 1600 },
  { quality: 75, maxDim: 1280 },
  { quality: 68, maxDim: 1024 },
  { quality: 60, maxDim: 900 },
  { quality: 50, maxDim: 720 },
];

/**
 * @param {Buffer} buffer    raw bytes from multer memoryStorage
 * @param {string} mimeType  validated MIME type
 * @param {number} maxBytes  ceiling — typical values: 200 * 1024, 300 * 1024
 * @returns {Promise<Buffer>} a compressed buffer when downsizing is
 *   possible + actually helps. Falls back to the original buffer on
 *   any error (we'd rather store a too-big image than fail the upload).
 */
async function compressToTargetBytes(buffer, mimeType, maxBytes) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return buffer;
  if (!maxBytes || buffer.length <= maxBytes) return buffer;
  const mime = String(mimeType || '').toLowerCase();
  if (!COMPRESSIBLE_MIMES.has(mime)) return buffer;

  try {
    let bestBuffer = buffer;
    for (const step of STEPS) {
      let pipeline = sharp(buffer, { failOn: 'none' }).rotate().resize({
        width: step.maxDim,
        height: step.maxDim,
        fit: 'inside',
        withoutEnlargement: true,
      });

      if (mime === 'image/png') {
        // Encode as JPEG when the source is opaque to save a lot of
        // bytes; preserve PNG when there's alpha so we don't black-
        // background a logo.
        const meta = await sharp(buffer).metadata();
        if (meta && meta.hasAlpha) {
          pipeline = pipeline.png({
            compressionLevel: 9,
            quality: step.quality,
            palette: true,
          });
        } else {
          pipeline = pipeline.jpeg({ quality: step.quality, mozjpeg: true });
        }
      } else if (mime === 'image/webp') {
        pipeline = pipeline.webp({ quality: step.quality });
      } else {
        // jpeg / jpg
        pipeline = pipeline.jpeg({ quality: step.quality, mozjpeg: true });
      }

      const out = await pipeline.toBuffer();
      bestBuffer = out;
      if (out.length <= maxBytes) return out;
    }
    // Even the most aggressive step couldn't hit the ceiling — return
    // whichever was smallest (the last step is always smallest because
    // the sweep monotonically shrinks both quality and dimensions).
    return bestBuffer.length < buffer.length ? bestBuffer : buffer;
  } catch (err) {
    // sharp couldn't decode — corrupt file, weird codec, etc. Persist
    // the original so the upload doesn't fail outright; admin can
    // delete it later if needed.
    console.warn(
      `[imageCompressor] failed for mime=${mime} bytes=${buffer.length}: ${
        err && err.message
      }`
    );
    return buffer;
  }
}

module.exports = { compressToTargetBytes, COMPRESSIBLE_MIMES };
