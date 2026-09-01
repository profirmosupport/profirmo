// socialVideoService — turns the rendered carousel cards into a short
// "daily news digest" MP4 for YouTube (which rejects image-only posts).
//
// Style: 1080×1080, each card held a few seconds with a soft CROSSFADE
// between slides, a fade-in from black and fade-out at the end, and a
// royalty-free background music bed mixed underneath (news-digest feel).
//
// Music: a bundled, royalty-free bed at assets/news-bed.m4a is used by
// default. Override with SOCIAL_VIDEO_MUSIC_PATH to drop in any track you
// have the rights to (e.g. from the YouTube Audio Library). If no music file
// is found the video renders silent.
//
// renderSlideshow(pngBuffers) → { buffer, mimeType, durationSec } or throws
// if ffmpeg is missing / fails (caller treats video as best-effort).

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';
const SECONDS_PER_CARD = Number(process.env.SOCIAL_VIDEO_SECONDS_PER_CARD) || 3.2;
const CROSSFADE = Number(process.env.SOCIAL_VIDEO_CROSSFADE) || 0.6;
const MUSIC_VOLUME = Number(process.env.SOCIAL_VIDEO_MUSIC_VOLUME) || 0.28;
const DEFAULT_MUSIC = path.join(__dirname, '../assets/news-bed.m4a');

function musicPath() {
  const p = process.env.SOCIAL_VIDEO_MUSIC_PATH || DEFAULT_MUSIC;
  try {
    return fs.existsSync(p) ? p : null;
  } catch {
    return null;
  }
}

function run(bin, args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 24000) stderr = stderr.slice(-24000);
    });
    child.on('error', (err) =>
      reject(new Error(`${bin} spawn failed: ${err.message} (is ffmpeg installed?)`))
    );
    child.on('close', (code) => {
      if (code === 0) return resolve();
      return reject(new Error(`${bin} exited ${code}: ${stderr.slice(-600)}`));
    });
  });
}

// Build the ffmpeg args for a crossfaded, faded, optionally-scored slideshow.
function buildArgs(frameFiles, outPath, music) {
  const D = SECONDS_PER_CARD;
  const T = Math.min(CROSSFADE, D / 2);
  const n = frameFiles.length;
  // Total after crossfades: each transition overlaps by T.
  const total = +(n * D - (n - 1) * T).toFixed(3);

  const args = ['-y'];
  frameFiles.forEach((f) => {
    args.push('-loop', '1', '-t', String(D), '-i', f);
  });
  if (music) args.push('-stream_loop', '-1', '-i', music);

  const fc = [];
  // Normalise every still to a clean 1080² 30fps stream.
  for (let i = 0; i < n; i += 1) {
    fc.push(
      `[${i}:v]scale=1080:1080:force_original_aspect_ratio=decrease,` +
        `pad=1080:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v${i}]`
    );
  }
  // Crossfade chain: v0⨯v1⨯…⨯v(n-1).
  let last = 'v0';
  if (n === 1) {
    last = 'v0';
  } else {
    for (let k = 1; k < n; k += 1) {
      const offset = +(k * (D - T)).toFixed(3);
      const label = k === n - 1 ? 'vjoined' : `x${k}`;
      fc.push(
        `[${last}][v${k}]xfade=transition=fade:duration=${T}:offset=${offset}[${label}]`
      );
      last = label;
    }
  }
  // Fade in from black + fade out at the end.
  fc.push(
    `[${last}]fade=t=in:st=0:d=0.4,fade=t=out:st=${(total - 0.6).toFixed(3)}:d=0.6[vout]`
  );

  if (music) {
    const musicIdx = n; // music is the input right after the frames
    fc.push(
      `[${musicIdx}:a]afade=t=in:d=1.2,afade=t=out:st=${(total - 1.5).toFixed(3)}:d=1.5,` +
        `volume=${MUSIC_VOLUME}[aout]`
    );
  }

  args.push('-filter_complex', fc.join(';'));
  args.push('-map', '[vout]');
  if (music) args.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '128k');
  args.push(
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-t', String(total),
    '-movflags', '+faststart',
    outPath
  );
  return { args, total };
}

/**
 * Build an MP4 news-digest slideshow from an ordered array of PNG buffers.
 * @param {Buffer[]} pngBuffers
 * @returns {Promise<{buffer:Buffer, mimeType:string, durationSec:number}>}
 */
async function renderSlideshow(pngBuffers) {
  const buffers = (Array.isArray(pngBuffers) ? pngBuffers : []).filter(Buffer.isBuffer);
  if (!buffers.length) throw new Error('renderSlideshow requires at least one image buffer.');

  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'social-vid-'));
  try {
    const frameFiles = [];
    for (let i = 0; i < buffers.length; i += 1) {
      const file = path.join(dir, `f${i}.png`);
      // eslint-disable-next-line no-await-in-loop
      await fs.promises.writeFile(file, buffers[i]);
      frameFiles.push(file);
    }
    const outPath = path.join(dir, 'out.mp4');
    const music = musicPath();
    const { args, total } = buildArgs(frameFiles, outPath, music);
    await run(FFMPEG_BIN, args, { cwd: dir });
    const buffer = await fs.promises.readFile(outPath);
    return { buffer, mimeType: 'video/mp4', durationSec: total, hasMusic: Boolean(music) };
  } finally {
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

module.exports = { renderSlideshow, isAvailable, musicPath, SECONDS_PER_CARD };
