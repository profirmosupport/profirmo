// socialVideoService — turns the rendered carousel cards into a short MP4
// slideshow for YouTube (which rejects image-only posts). Silent, 1080×1080,
// each card held for a few seconds. Uses the system `ffmpeg` binary via the
// concat demuxer — no npm codec deps.
//
// renderSlideshow(pngBuffers) → { buffer, mimeType, durationSec } or throws if
// ffmpeg is missing / fails (caller treats video as best-effort).

const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';
const SECONDS_PER_CARD = Number(process.env.SOCIAL_VIDEO_SECONDS_PER_CARD) || 3;

function run(bin, args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 20000) stderr = stderr.slice(-20000);
    });
    child.on('error', (err) =>
      reject(new Error(`${bin} spawn failed: ${err.message} (is ffmpeg installed?)`))
    );
    child.on('close', (code) => {
      if (code === 0) return resolve();
      return reject(new Error(`${bin} exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

/**
 * Build an MP4 slideshow from an ordered array of PNG buffers.
 * @param {Buffer[]} pngBuffers
 * @param {object} [opts]
 * @param {number} [opts.secondsPerCard]
 * @returns {Promise<{buffer:Buffer, mimeType:string, durationSec:number}>}
 */
async function renderSlideshow(pngBuffers, opts = {}) {
  const buffers = (Array.isArray(pngBuffers) ? pngBuffers : []).filter(Buffer.isBuffer);
  if (!buffers.length) throw new Error('renderSlideshow requires at least one image buffer.');
  const secs = Number(opts.secondsPerCard) || SECONDS_PER_CARD;

  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'social-vid-'));
  try {
    // Write each frame + a concat list. The concat demuxer needs the LAST
    // entry repeated with no duration, otherwise the final image's duration
    // is dropped.
    const listLines = [];
    for (let i = 0; i < buffers.length; i += 1) {
      const file = path.join(dir, `f${i}.png`);
      await fs.promises.writeFile(file, buffers[i]);
      listLines.push(`file '${file}'`);
      listLines.push(`duration ${secs}`);
    }
    listLines.push(`file '${path.join(dir, `f${buffers.length - 1}.png`)}'`);
    const listPath = path.join(dir, 'frames.txt');
    await fs.promises.writeFile(listPath, listLines.join('\n'));

    const outPath = path.join(dir, 'out.mp4');
    await run(FFMPEG_BIN, [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      // Even dimensions + yuv420p so every player (and YouTube) accepts it;
      // pad guards against any odd source size. 30fps for smooth playback.
      '-vf', 'scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p,fps=30',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      outPath,
    ], { cwd: dir });

    const buffer = await fs.promises.readFile(outPath);
    return {
      buffer,
      mimeType: 'video/mp4',
      durationSec: buffers.length * secs,
    };
  } finally {
    // Clean up temp frames regardless of success.
    fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function isAvailable() {
  try {
    await run(FFMPEG_BIN, ['-version']);
    return true;
  } catch {
    return false;
  }
}

module.exports = { renderSlideshow, isAvailable, SECONDS_PER_CARD };
