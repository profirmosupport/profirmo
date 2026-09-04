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
const CAROUSEL_H = 1080; // 1:1 — Instagram carousel (square)
const VIDEO_H = 1920; // 9:16 — YouTube Short frames (only if video enabled)
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

// Fit a list of full text items into an available box by shrinking the font
// until every item (wrapped to as many lines as needed — NEVER truncated)
// fits `availHeightPx`. Returns the chosen font + line metrics + wrapped lines.
// This is how the news text stays COMPLETE and still fits the card.
function fitItems(items, availWidthPx, availHeightPx, opts = {}) {
  const maxFont = opts.maxFont || 50;
  const minFont = opts.minFont || 28;
  const lhMul = opts.lhMul || 1.16;
  const gapMul = opts.gapMul || 0.72;
  const widthFactor = opts.widthFactor || 0.6; // ~avg Devanagari advance / font px
  let best = null;
  for (let font = maxFont; font >= minFont; font -= 2) {
    const cpl = Math.max(10, Math.floor(availWidthPx / (widthFactor * font)));
    const lineH = Math.round(font * lhMul);
    const gap = Math.round(font * gapMul);
    const wrapped = items.map((t) => wrap(t, cpl, 12));
    const blockH = wrapped.reduce((s, l) => s + l.length * lineH + gap, 0);
    best = { font, lineH, gap, wrapped, blockH };
    if (blockH <= availHeightPx) break;
  }
  return best;
}

// Fit a SINGLE text block (headline / hook) — full text, wrapped to as many
// lines as needed, font shrunk until it fits the height box. Never truncated.
function fitText(text, availWidthPx, availHeightPx, opts = {}) {
  const maxFont = opts.maxFont || 84;
  const minFont = opts.minFont || 50;
  const lhMul = opts.lhMul || 1.08;
  const widthFactor = opts.widthFactor || 0.6;
  let best = null;
  for (let font = maxFont; font >= minFont; font -= 2) {
    const cpl = Math.max(6, Math.floor(availWidthPx / (widthFactor * font)));
    const lineH = Math.round(font * lhMul);
    const lines = wrap(text, cpl, 8);
    const blockH = lines.length * lineH;
    best = { font, lineH, lines, blockH };
    if (blockH <= availHeightPx) break;
  }
  return best;
}

function coverSvg({ eyebrow, hook, highlights }, total, H) {
  const hi = (Array.isArray(highlights) ? highlights : [])
    .map((h) => String(h).trim())
    .filter(Boolean)
    .slice(0, 3);
  const HEADER_TOP = 380;
  const FOOTER_TOP = H - 120;
  const areaH = FOOTER_TOP - HEADER_TOP;
  const LABEL_H = 56;
  const HI_GAP = 96; // divider + label spacing
  // Auto-fit the FULL hook (complete, never truncated) into ~half the area…
  const hookFit = fitText(hook || '', 900, Math.round(areaH * 0.52), {
    maxFont: 92, minFont: 56, widthFactor: 0.62,
  });
  // …then fit the FULL highlight teasers into the space that remains.
  const hiAvailH = areaH - hookFit.blockH - HI_GAP - LABEL_H - 78;
  const fit = fitItems(hi, 868, hiAvailH, { maxFont: 46, minFont: 30, gapMul: 0.7 });

  const blockTotal = hookFit.blockH + HI_GAP + LABEL_H + 78 + fit.blockH;
  const top = centreTop(H, blockTotal, HEADER_TOP, 120);
  const hookTop = top + Math.round(hookFit.font * 0.82);
  const divY = hookTop + (hookFit.lines.length - 1) * hookFit.lineH + 40;
  const hiLabelY = divY + 96;
  let hy = hiLabelY + 78;
  const hiSvg = fit.wrapped
    .map((lines) => {
      const parts = [
        `<text x="${LX}" y="${hy}" font-family="${FF}" font-size="${fit.font}" font-weight="700" fill="#f59e0b">›</text>`,
        ...lines.map((ln, li) => `<text x="${LX + 52}" y="${hy + li * fit.lineH}" font-family="${FF}" font-size="${fit.font}" fill="#e2e8f0">${esc(ln)}</text>`),
      ].join('');
      hy += lines.length * fit.lineH + fit.gap;
      return parts;
    })
    .join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${DEFS}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>${blobs(H)}
  <text x="${LX}" y="300" font-family="${FF}" font-size="38" font-weight="700" fill="#f59e0b">${esc(eyebrow)}</text>
  ${hookFit.lines.map((l, i) => `<text x="${LX}" y="${hookTop + i * hookFit.lineH}" font-family="${FF}" font-size="${hookFit.font}" font-weight="800" fill="#fff">${esc(l)}</text>`).join('')}
  <rect x="${LX}" y="${divY}" width="170" height="9" rx="4.5" fill="url(#acc)"/>
  <text x="${LX}" y="${hiLabelY}" font-family="${FF}" font-size="34" font-weight="700" fill="#f59e0b">आज की सुर्खियाँ</text>
  ${hiSvg}
  <text x="990" y="${H - 66}" text-anchor="end" font-family="${FF}" font-size="30" font-weight="700" fill="#fff">1 / ${total} ›</text>
</svg>`);
}

function contentSvg({ tag, headline, points }, slide, total, H) {
  const rawPts = (points || []).slice(0, 4).map((p) => String(p).trim()).filter(Boolean);
  const GAP_AFTER_HEAD = 100;
  const HEADER_TOP = 400;
  const FOOTER_TOP = H - 150;
  const areaH = FOOTER_TOP - HEADER_TOP;
  // Auto-fit the FULL headline (complete, never truncated) into ~half the area…
  const hFit = fitText(headline || '', 900, Math.round(areaH * 0.5), {
    maxFont: 80, minFont: 50, widthFactor: 0.62,
  });
  // …then fit the FULL bullet text into what remains.
  const bulletsAvailH = areaH - hFit.blockH - GAP_AFTER_HEAD;
  const fit = fitItems(rawPts, 862, bulletsAvailH, { maxFont: 48, minFont: 28, gapMul: 0.78 });
  const dotR = Math.max(9, Math.round(fit.font * 0.26));

  const blockTotal = hFit.blockH + GAP_AFTER_HEAD + fit.blockH;
  const top = centreTop(H, blockTotal, HEADER_TOP, 150);
  const headTop = top + Math.round(hFit.font * 0.82);
  const divY = headTop + (hFit.lines.length - 1) * hFit.lineH + 34;

  let py = divY + GAP_AFTER_HEAD;
  const ptsSvg = fit.wrapped
    .map((lines) => {
      const parts = [
        `<circle cx="${LX + 16}" cy="${py - Math.round(fit.font * 0.32)}" r="${dotR}" fill="#f59e0b"/>`,
        ...lines.map((ln, li) => `<text x="${LX + 58}" y="${py + li * fit.lineH}" font-family="${FF}" font-size="${fit.font}" font-weight="600" fill="#e2e8f0">${esc(ln)}</text>`),
      ].join('');
      py += lines.length * fit.lineH + fit.gap;
      return parts;
    })
    .join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${DEFS}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>${blobs(H)}
  <text x="${LX}" y="330" font-family="${FF}" font-size="38" font-weight="700" fill="#f59e0b">${esc(tag)}</text>
  ${hFit.lines.map((l, i) => `<text x="${LX}" y="${headTop + i * hFit.lineH}" font-family="${FF}" font-size="${hFit.font}" font-weight="800" fill="#fff">${esc(l)}</text>`).join('')}
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
