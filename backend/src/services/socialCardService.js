// socialCardService — renders vertical cards for the daily legal & tax social
// post, in Hindi (Devanagari). Pure server-side composition with `sharp`
// (SVG → PNG). No external image API — Claude writes the words, this file draws
// them onto the brand template with the real logo.
//
// Height is a parameter so the SAME layout serves two targets:
//   • 1080×1350 (4:5) — the Instagram carousel POST. 4:5 is Instagram's tallest
//     feed ratio, so nothing is cropped/cut in the feed.
//   • 1080×1920 (9:16) — the YouTube slideshow video (Short) frames.
// The main content block is vertically centred between a top header (logo +
// eyebrow) and a bottom footer, so both heights look balanced and aligned.
//
// Devanagari: the server has fonts-noto-sans-devanagari installed.

const path = require('path');
const sharp = require('sharp');

const LOGO_PATH =
  process.env.SOCIAL_LOGO_PATH || path.join(__dirname, '../assets/profirmo-logo.png');

const FF = 'Noto Sans Devanagari, Inter, Arial, sans-serif';
const W = 1080;
const CAROUSEL_H = 1350; // 4:5 — Instagram carousel
const VIDEO_H = 1920; // 9:16 — YouTube Short frames
const LX = 90; // left margin

const DEFS = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1220"/><stop offset="0.55" stop-color="#111827"/><stop offset="1" stop-color="#3b1d06"/></linearGradient>
  <linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#d97706"/></linearGradient>
  <linearGradient id="cta" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d97706"/><stop offset="1" stop-color="#b45309"/></linearGradient>
</defs>`;

function blobs(H) {
  return `
  <circle cx="900" cy="${Math.round(H * 0.16)}" r="320" fill="#f59e0b" opacity="0.10"/>
  <circle cx="150" cy="${Math.round(H * 0.88)}" r="320" fill="#14b8a6" opacity="0.07"/>`;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function wrap(text, max, maxLines = 4) {
  const words = String(text || '').trim().split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = (line + ' ' + w).trim();
    if (next.length > max && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/[\s…]+$/, '') + '…';
    return kept;
  }
  return lines;
}

// Vertically centre a block of height `blockH` between top and bottom guides.
function centreTop(H, blockH, top = 360, bottomPad = 220) {
  const bottom = H - bottomPad;
  return Math.round(top + Math.max(0, (bottom - top - blockH) / 2));
}

function footerSvg(H, slide, total, dark = true) {
  const line = dark ? '#334155' : '#fef3c7';
  const meta = dark ? '#94a3b8' : '#fff7ed';
  const handle = process.env.SOCIAL_HANDLE || '@profirmoinsta';
  const dateLabel = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const ly = H - 120;
  const ty = H - 66;
  return `
  <line x1="${LX}" y1="${ly}" x2="990" y2="${ly}" stroke="${line}" stroke-width="2"/>
  <text x="${LX}" y="${ty}" font-family="${FF}" font-size="30" fill="${meta}">${esc(handle)} · ${esc(dateLabel)}</text>
  <text x="990" y="${ty}" text-anchor="end" font-family="${FF}" font-size="30" font-weight="700" fill="#fff">${slide} / ${total} ${slide < total ? '›' : ''}</text>`;
}

function coverSvg({ eyebrow, hook, highlights }, total, H) {
  const hookLines = wrap(hook || '', 12, 3);
  // One-line teasers (truncated to fit the width) keep the cover compact and
  // prevent the highlights from colliding with the footer.
  const hi = (Array.isArray(highlights) ? highlights : [])
    .slice(0, 3)
    .map((h) => wrap(h, 26, 1)[0])
    .filter(Boolean);
  const HOOK_LH = 104;
  const HL_STEP = 100;
  const blockH = hookLines.length * HOOK_LH + 70 + 56 + hi.length * HL_STEP;
  const top = centreTop(H, blockH, 400, 170);
  const hookTop = top + 80;
  const divY = hookTop + (hookLines.length - 1) * HOOK_LH + 34;
  const hiLabelY = divY + 96;
  const hiTop = hiLabelY + 78;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${DEFS}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>${blobs(H)}
  <text x="${LX}" y="300" font-family="${FF}" font-size="38" font-weight="700" fill="#f59e0b">${esc(eyebrow)}</text>
  ${hookLines.map((l, i) => `<text x="${LX}" y="${hookTop + i * HOOK_LH}" font-family="${FF}" font-size="90" font-weight="800" fill="#fff">${esc(l)}</text>`).join('')}
  <rect x="${LX}" y="${divY}" width="170" height="9" rx="4.5" fill="url(#acc)"/>
  <text x="${LX}" y="${hiLabelY}" font-family="${FF}" font-size="34" font-weight="700" fill="#f59e0b">आज की सुर्खियाँ</text>
  ${hi.map((l, i) => {
    const y = hiTop + i * HL_STEP;
    return `<text x="${LX}" y="${y}" font-family="${FF}" font-size="44" font-weight="700" fill="#f59e0b">›</text><text x="${LX + 52}" y="${y}" font-family="${FF}" font-size="42" fill="#e2e8f0">${esc(l)}</text>`;
  }).join('')}
  <text x="990" y="${H - 66}" text-anchor="end" font-family="${FF}" font-size="30" font-weight="700" fill="#fff">1 / ${total} ›</text>
</svg>`);
}

function contentSvg({ tag, headline, points }, slide, total, H) {
  const hl = wrap(headline, 15, 3);
  // Wrap each bullet to the card width (≤2 lines) so a long point never runs
  // off the right edge and gets cut; cap to 3 bullets so it fits the 4:5 card.
  const pts = (points || []).slice(0, 3).map((p) => wrap(p, 20, 2));
  const HEAD_LH = 94;
  const PT_LINE = 52;
  const PT_GAP = 44;
  const ptsBlock = pts.reduce((s, lines) => s + lines.length * PT_LINE + PT_GAP, 0);
  const blockH = hl.length * HEAD_LH + 100 + ptsBlock;
  const top = centreTop(H, blockH, 360, 210);
  const headTop = top + 70;
  const divY = headTop + (hl.length - 1) * HEAD_LH + 34;
  let py = divY + 110;
  const ptsSvg = pts
    .map((lines) => {
      const parts = [
        `<circle cx="${LX + 16}" cy="${py - 16}" r="13" fill="#f59e0b"/>`,
        ...lines.map((ln, li) => `<text x="${LX + 58}" y="${py + li * PT_LINE}" font-family="${FF}" font-size="48" font-weight="600" fill="#e2e8f0">${esc(ln)}</text>`),
      ].join('');
      py += lines.length * PT_LINE + PT_GAP;
      return parts;
    })
    .join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${DEFS}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>${blobs(H)}
  <text x="${LX}" y="330" font-family="${FF}" font-size="38" font-weight="700" fill="#f59e0b">${esc(tag)}</text>
  ${hl.map((l, i) => `<text x="${LX}" y="${headTop + i * HEAD_LH}" font-family="${FF}" font-size="78" font-weight="800" fill="#fff">${esc(l)}</text>`).join('')}
  <rect x="${LX}" y="${divY}" width="170" height="9" rx="4.5" fill="url(#acc)"/>
  ${ptsSvg}
  ${footerSvg(H, slide, total)}
</svg>`);
}

function ctaSvg({ titleLines, sub1, sub2, url }, total, H) {
  const t = (Array.isArray(titleLines) ? titleLines : []).slice(0, 2);
  const TITLE_LH = 118;
  const blockH = t.length * TITLE_LH + 200 + 116;
  const top = centreTop(H, blockH, 360, 200);
  const titleTop = top + 90;
  const subY = titleTop + (t.length - 1) * TITLE_LH + 150;
  const btnY = subY + 120;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${DEFS}
  <rect width="${W}" height="${H}" fill="url(#cta)"/>
  <circle cx="900" cy="${Math.round(H * 0.17)}" r="360" fill="#fff" opacity="0.08"/>
  <circle cx="180" cy="${Math.round(H * 0.86)}" r="320" fill="#000" opacity="0.10"/>
  ${t.map((l, i) => `<text x="${LX}" y="${titleTop + i * TITLE_LH}" font-family="${FF}" font-size="100" font-weight="800" fill="#fff">${esc(l)}</text>`).join('')}
  <text x="${LX}" y="${subY}" font-family="${FF}" font-size="46" fill="#fff7ed">${esc(sub1)}</text>
  <text x="${LX}" y="${subY + 62}" font-family="${FF}" font-size="46" fill="#fff7ed">${esc(sub2)}</text>
  <rect x="${LX}" y="${btnY}" width="680" height="112" rx="56" fill="#0b1220"/>
  <text x="${LX + 340}" y="${btnY + 72}" text-anchor="middle" font-family="${FF}" font-size="46" font-weight="700" fill="#fff">${esc(url)}</text>
  <text x="990" y="${H - 66}" text-anchor="end" font-family="${FF}" font-size="30" font-weight="700" fill="#fff">${total} / ${total}</text>
</svg>`);
}

async function brandSvg(svgBuffer, { cta = false } = {}) {
  let logo = null;
  try {
    logo = await sharp(LOGO_PATH).resize(140, 140).png().toBuffer();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[socialCard] logo not found, rendering without it:', err.message);
  }
  const layers = [];
  if (logo && cta) {
    layers.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="166" height="166"><circle cx="83" cy="83" r="83" fill="#ffffff" opacity="0.95"/></svg>`
      ),
      top: 78,
      left: LX - 13,
    });
  }
  if (logo) layers.push({ input: logo, top: 90, left: LX });
  return sharp(svgBuffer).composite(layers).png().toBuffer();
}

/**
 * Render a full deck to an array of PNG buffers at the given height.
 * @param {object} deck { cover, cards[], cta }
 * @param {object} [opts] { height } — 1350 (4:5 carousel, default) or 1920 (9:16 video)
 * @returns {Promise<Buffer[]>}
 */
async function renderDeck(deck, opts = {}) {
  const H = opts.height || CAROUSEL_H;
  const cards = Array.isArray(deck.cards) ? deck.cards.slice(0, 5) : [];
  const total = cards.length + 2;
  const buffers = [];
  buffers.push(await brandSvg(coverSvg(deck.cover, total, H)));
  for (let i = 0; i < cards.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    buffers.push(await brandSvg(contentSvg(cards[i], i + 2, total, H)));
  }
  buffers.push(await brandSvg(ctaSvg(deck.cta, total, H), { cta: true }));
  return buffers;
}

module.exports = { renderDeck, wrap, FF, LOGO_PATH, WIDTH: W, CAROUSEL_H, VIDEO_H };
