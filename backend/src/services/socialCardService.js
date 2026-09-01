// socialCardService — renders 9:16 (1080×1920) vertical cards for the daily
// legal & tax social post, in Hindi (Devanagari). Pure server-side composition
// with `sharp` (SVG → PNG). No external image API — Claude writes the words,
// this file draws them onto the brand template with the real logo.
//
// 9:16 is the vertical format for Instagram Reels/Stories and the carousel
// post, and the YouTube slideshow video (Short). Layout is a single centred
// column that reads top-to-bottom on a phone.
//
// Feed-crop note: a 9:16 image in an Instagram FEED carousel is centre-cropped
// to 4:5 by Instagram. So the critical content (headline, bullets) is kept in
// the vertical middle band; the logo (top) and footer (bottom) may crop in the
// feed thumbnail but show in full in the Reel/Story/expanded view.
//
// Devanagari: the server has fonts-noto-sans-devanagari installed.

const path = require('path');
const sharp = require('sharp');

const LOGO_PATH =
  process.env.SOCIAL_LOGO_PATH || path.join(__dirname, '../assets/profirmo-logo.png');

const FF = 'Noto Sans Devanagari, Inter, Arial, sans-serif';
const W = 1080;
const H = 1920;
const LX = 90; // left margin

const DEFS = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1220"/><stop offset="0.55" stop-color="#111827"/><stop offset="1" stop-color="#3b1d06"/></linearGradient>
  <linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#d97706"/></linearGradient>
  <linearGradient id="cta" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d97706"/><stop offset="1" stop-color="#b45309"/></linearGradient>
</defs>`;

const BLOBS = `
  <circle cx="900" cy="300" r="320" fill="#f59e0b" opacity="0.10"/>
  <circle cx="150" cy="1680" r="320" fill="#14b8a6" opacity="0.07"/>`;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Greedy word-wrap to at most `max` chars per line, capped at `maxLines`.
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

function footerSvg(slide, total, dark = true) {
  const line = dark ? '#334155' : '#fef3c7';
  const meta = dark ? '#94a3b8' : '#fff7ed';
  const handle = process.env.SOCIAL_HANDLE || '@profirmoinsta';
  const dateLabel = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `
  <line x1="${LX}" y1="1790" x2="990" y2="1790" stroke="${line}" stroke-width="2"/>
  <text x="${LX}" y="1850" font-family="${FF}" font-size="32" fill="${meta}">${esc(handle)} · ${esc(dateLabel)}</text>
  <text x="990" y="1850" text-anchor="end" font-family="${FF}" font-size="32" font-weight="700" fill="#fff">${slide} / ${total} ${slide < total ? '›' : ''}</text>`;
}

// Cover = a daily "highlights" card: dated eyebrow, a punchy Hindi hook, then a
// list of teasers of the day's actual stories — unique every day.
function coverSvg({ eyebrow, hook, highlights, swipe }, total) {
  const hookLines = wrap(hook || '', 12, 3);
  const hookTop = 640;
  const hi = (Array.isArray(highlights) ? highlights : []).slice(0, 3);
  const hiTop = hookTop + hookLines.length * 118 + 150;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${DEFS}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>${BLOBS}
  <text x="${LX}" y="480" font-family="${FF}" font-size="40" font-weight="700" fill="#f59e0b">${esc(eyebrow)}</text>
  ${hookLines.map((l, i) => `<text x="${LX}" y="${hookTop + i * 118}" font-family="${FF}" font-size="100" font-weight="800" fill="#fff">${esc(l)}</text>`).join('')}
  <rect x="${LX}" y="${hookTop + hookLines.length * 118 - 20}" width="170" height="9" rx="4.5" fill="url(#acc)"/>
  <text x="${LX}" y="${hiTop - 40}" font-family="${FF}" font-size="36" font-weight="700" fill="#f59e0b">आज की सुर्खियाँ</text>
  ${hi.map((l, i) => {
    const y = hiTop + 60 + i * 130;
    return `<text x="${LX}" y="${y}" font-family="${FF}" font-size="48" font-weight="700" fill="#f59e0b">›</text><text x="${LX + 54}" y="${y}" font-family="${FF}" font-size="46" fill="#e2e8f0">${esc(l)}</text>`;
  }).join('')}
  <text x="${LX}" y="1700" font-family="${FF}" font-size="44" font-weight="700" fill="#f59e0b">${esc(swipe)}</text>
  <text x="990" y="1850" text-anchor="end" font-family="${FF}" font-size="32" font-weight="700" fill="#fff">1 / ${total} ›</text>
</svg>`);
}

// Content card: source tag, headline, then bullet takeaways — stacked.
function contentSvg({ tag, headline, points }, slide, total) {
  const hl = wrap(headline, 15, 4);
  const pts = (points || []).slice(0, 4);
  const headTop = 560;
  const ptsTop = headTop + hl.length * 108 + 150;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${DEFS}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>${BLOBS}
  <text x="${LX}" y="460" font-family="${FF}" font-size="40" font-weight="700" fill="#f59e0b">${esc(tag)}</text>
  ${hl.map((l, i) => `<text x="${LX}" y="${headTop + i * 108}" font-family="${FF}" font-size="88" font-weight="800" fill="#fff">${esc(l)}</text>`).join('')}
  <rect x="${LX}" y="${headTop + hl.length * 108 - 22}" width="170" height="9" rx="4.5" fill="url(#acc)"/>
  ${pts.map((p, i) => {
    const y = ptsTop + i * 132;
    return `<circle cx="${LX + 16}" cy="${y - 16}" r="14" fill="#f59e0b"/><text x="${LX + 60}" y="${y}" font-family="${FF}" font-size="50" font-weight="600" fill="#e2e8f0">${esc(p)}</text>`;
  }).join('')}
  ${footerSvg(slide, total)}
</svg>`);
}

function ctaSvg({ titleLines, sub1, sub2, url }, total) {
  const t = (Array.isArray(titleLines) ? titleLines : []).slice(0, 2);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${DEFS}
  <rect width="${W}" height="${H}" fill="url(#cta)"/>
  <circle cx="900" cy="320" r="360" fill="#fff" opacity="0.08"/>
  <circle cx="180" cy="1650" r="320" fill="#000" opacity="0.10"/>
  ${t.map((l, i) => `<text x="${LX}" y="${740 + i * 124}" font-family="${FF}" font-size="104" font-weight="800" fill="#fff">${esc(l)}</text>`).join('')}
  <text x="${LX}" y="1120" font-family="${FF}" font-size="48" fill="#fff7ed">${esc(sub1)}</text>
  <text x="${LX}" y="1190" font-family="${FF}" font-size="48" fill="#fff7ed">${esc(sub2)}</text>
  <rect x="${LX}" y="1280" width="700" height="116" rx="58" fill="#0b1220"/>
  <text x="${LX + 350}" y="1354" text-anchor="middle" font-family="${FF}" font-size="48" font-weight="700" fill="#fff">${esc(url)}</text>
  <text x="990" y="1850" text-anchor="end" font-family="${FF}" font-size="32" font-weight="700" fill="#fff">${total} / ${total}</text>
</svg>`);
}

// Composite the real logo top-left. On the amber CTA card drop a soft white
// disc behind it so the logo's own gradient stays legible.
async function brandSvg(svgBuffer, { cta = false } = {}) {
  let logo = null;
  try {
    logo = await sharp(LOGO_PATH).resize(150, 150).png().toBuffer();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[socialCard] logo not found, rendering without it:', err.message);
  }
  const layers = [];
  if (logo && cta) {
    layers.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="178" height="178"><circle cx="89" cy="89" r="89" fill="#ffffff" opacity="0.95"/></svg>`
      ),
      top: 176,
      left: LX - 14,
    });
  }
  if (logo) layers.push({ input: logo, top: 190, left: LX });
  return sharp(svgBuffer).composite(layers).png().toBuffer();
}

/**
 * Render a full deck to an array of 1080×1920 (9:16) PNG buffers.
 * @param {object} deck
 * @param {object} deck.cover   { eyebrow, hook, highlights[], swipe }
 * @param {object[]} deck.cards [{ tag, headline, points[] }]  (2..5)
 * @param {object} deck.cta     { titleLines[], sub1, sub2, url }
 * @returns {Promise<Buffer[]>}
 */
async function renderDeck(deck) {
  const cards = Array.isArray(deck.cards) ? deck.cards.slice(0, 5) : [];
  const total = cards.length + 2; // cover + content + cta
  const buffers = [];
  buffers.push(await brandSvg(coverSvg(deck.cover, total)));
  for (let i = 0; i < cards.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    buffers.push(await brandSvg(contentSvg(cards[i], i + 2, total)));
  }
  buffers.push(await brandSvg(ctaSvg(deck.cta, total), { cta: true }));
  return buffers;
}

module.exports = { renderDeck, wrap, FF, LOGO_PATH, WIDTH: W, HEIGHT: H };
