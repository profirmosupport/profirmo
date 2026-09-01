// socialCardService — renders 16:9 (1920×1080) landscape cards for the daily
// legal & tax social post, in Hindi (Devanagari). Pure server-side composition
// with `sharp` (SVG → PNG). No external image API — Claude writes the words,
// this file draws them onto the brand template with the real logo.
//
// 16:9 is used for BOTH the Instagram carousel (landscape post) and the
// YouTube slideshow video (native 1920×1080). Layouts are two-column so the
// wide frame stays balanced: headline/hook on the left, bullets/highlights on
// the right.
//
// A "deck" is: 1 cover + N content cards (2–5) + 1 CTA. renderDeck() returns an
// array of PNG buffers ready to upload to S3 / feed to the video renderer.
//
// Devanagari note: librsvg renders whatever font fontconfig resolves. The
// server has fonts-noto-sans-devanagari installed (see deploy notes).

const path = require('path');
const sharp = require('sharp');

const LOGO_PATH =
  process.env.SOCIAL_LOGO_PATH || path.join(__dirname, '../assets/profirmo-logo.png');

const FF = 'Noto Sans Devanagari, Inter, Arial, sans-serif';
const W = 1920;
const H = 1080;
const LX = 100; // left margin
const RX = 1010; // right column start

const DEFS = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1220"/><stop offset="0.6" stop-color="#111827"/><stop offset="1" stop-color="#3b1d06"/></linearGradient>
  <linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#d97706"/></linearGradient>
  <linearGradient id="cta" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d97706"/><stop offset="1" stop-color="#b45309"/></linearGradient>
</defs>`;

const BLOBS = `
  <circle cx="1740" cy="210" r="280" fill="#f59e0b" opacity="0.10"/>
  <circle cx="150" cy="1000" r="260" fill="#14b8a6" opacity="0.08"/>`;

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
  <line x1="${LX}" y1="985" x2="1820" y2="985" stroke="${line}" stroke-width="2"/>
  <text x="${LX}" y="1035" font-family="${FF}" font-size="28" fill="${meta}">${esc(handle)} · ${esc(dateLabel)}</text>
  <text x="1820" y="1035" text-anchor="end" font-family="${FF}" font-size="28" font-weight="700" fill="#fff">${slide} / ${total} ${slide < total ? '›' : ''}</text>`;
}

// Cover = a daily "highlights" card. `hook` (the day's punchy Hindi headline)
// fills the left column; `highlights` (teasers of the actual stories) list down
// the right column — unique every day, never a fixed template.
function coverSvg({ eyebrow, hook, highlights, swipe }, total) {
  const hookLines = wrap(hook || '', 13, 3);
  const hookTop = 400;
  const hi = (Array.isArray(highlights) ? highlights : []).slice(0, 3);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${DEFS}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>${BLOBS}
  <text x="${LX}" y="250" font-family="${FF}" font-size="36" font-weight="700" fill="#f59e0b">${esc(eyebrow)}</text>
  ${hookLines.map((l, i) => `<text x="${LX}" y="${hookTop + i * 96}" font-family="${FF}" font-size="86" font-weight="800" fill="#fff">${esc(l)}</text>`).join('')}
  <rect x="${LX}" y="${hookTop + hookLines.length * 96 - 26}" width="150" height="8" rx="4" fill="url(#acc)"/>
  <text x="${RX}" y="330" font-family="${FF}" font-size="30" font-weight="700" letter-spacing="1" fill="#f59e0b">आज की सुर्खियाँ</text>
  ${hi.map((l, i) => {
    const y = 420 + i * 110;
    return `<text x="${RX}" y="${y}" font-family="${FF}" font-size="42" font-weight="700" fill="#f59e0b">›</text><text x="${RX + 44}" y="${y}" font-family="${FF}" font-size="40" fill="#e2e8f0">${esc(l)}</text>`;
  }).join('')}
  <text x="${LX}" y="960" font-family="${FF}" font-size="38" font-weight="700" fill="#f59e0b">${esc(swipe)}</text>
  <text x="1820" y="1035" text-anchor="end" font-family="${FF}" font-size="28" font-weight="700" fill="#fff">1 / ${total} ›</text>
</svg>`);
}

// Content card: source tag + headline on the left, bullet takeaways on the right.
function contentSvg({ tag, headline, points }, slide, total) {
  const hl = wrap(headline, 15, 4);
  const pts = (points || []).slice(0, 4);
  const headTop = 350;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${DEFS}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>${BLOBS}
  <text x="${LX}" y="235" font-family="${FF}" font-size="34" font-weight="700" fill="#f59e0b">${esc(tag)}</text>
  ${hl.map((l, i) => `<text x="${LX}" y="${headTop + i * 88}" font-family="${FF}" font-size="72" font-weight="800" fill="#fff">${esc(l)}</text>`).join('')}
  <rect x="${LX}" y="${headTop + hl.length * 88 - 22}" width="150" height="8" rx="4" fill="url(#acc)"/>
  ${pts.map((p, i) => {
    const y = 360 + i * 108;
    return `<circle cx="${RX + 10}" cy="${y - 13}" r="12" fill="#f59e0b"/><text x="${RX + 50}" y="${y}" font-family="${FF}" font-size="44" font-weight="600" fill="#e2e8f0">${esc(p)}</text>`;
  }).join('')}
  ${footerSvg(slide, total)}
</svg>`);
}

function ctaSvg({ titleLines, sub1, sub2, url }, total) {
  const t = (Array.isArray(titleLines) ? titleLines : []).slice(0, 2);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${DEFS}
  <rect width="${W}" height="${H}" fill="url(#cta)"/>
  <circle cx="1720" cy="220" r="300" fill="#fff" opacity="0.08"/>
  <circle cx="180" cy="980" r="260" fill="#000" opacity="0.10"/>
  ${t.map((l, i) => `<text x="${LX}" y="${430 + i * 108}" font-family="${FF}" font-size="92" font-weight="800" fill="#fff">${esc(l)}</text>`).join('')}
  <text x="${LX}" y="720" font-family="${FF}" font-size="44" fill="#fff7ed">${esc(sub1)}</text>
  <text x="${LX}" y="782" font-family="${FF}" font-size="44" fill="#fff7ed">${esc(sub2)}</text>
  <rect x="${LX}" y="850" width="600" height="96" rx="48" fill="#0b1220"/>
  <text x="${LX + 300}" y="912" text-anchor="middle" font-family="${FF}" font-size="42" font-weight="700" fill="#fff">${esc(url)}</text>
  <text x="1820" y="1035" text-anchor="end" font-family="${FF}" font-size="28" font-weight="700" fill="#fff">${total} / ${total}</text>
</svg>`);
}

// Composite the real logo top-left. On the amber CTA card drop a soft white
// disc behind it so the logo's own gradient stays legible.
async function brandSvg(svgBuffer, { cta = false } = {}) {
  let logo = null;
  try {
    logo = await sharp(LOGO_PATH).resize(128, 128).png().toBuffer();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[socialCard] logo not found, rendering without it:', err.message);
  }
  const layers = [];
  if (logo && cta) {
    layers.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="152" height="152"><circle cx="76" cy="76" r="76" fill="#ffffff" opacity="0.95"/></svg>`
      ),
      top: 64,
      left: LX - 12,
    });
  }
  if (logo) layers.push({ input: logo, top: 76, left: LX });
  return sharp(svgBuffer).composite(layers).png().toBuffer();
}

/**
 * Render a full deck to an array of 1920×1080 PNG buffers.
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
