// socialCardService — renders 1:1 (1080×1080) Instagram/YouTube cards for the
// daily legal & tax social post, in Hindi (Devanagari). Pure server-side
// composition with `sharp` (SVG → PNG). No external image API — Claude writes
// the words, this file draws them onto the brand template with the real logo.
//
// A "deck" is: 1 cover + N content cards (2–5) + 1 CTA. renderDeck() returns an
// array of PNG buffers ready to upload to S3.
//
// Devanagari note: librsvg renders whatever font fontconfig resolves for the
// glyphs. Locally macOS ships Kohinoor/Devanagari MT; on the Ubuntu server we
// install fonts-noto-sans-devanagari (see deploy notes) so the family below
// resolves. Missing-glyph substitution means it renders even if the exact
// family is absent, but installing the font keeps it crisp + consistent.

const path = require('path');
const sharp = require('sharp');

const LOGO_PATH =
  process.env.SOCIAL_LOGO_PATH || path.join(__dirname, '../assets/profirmo-logo.png');

// Devanagari-capable stack. Noto first (installed on the server), then Latin
// fallbacks for digits / ASCII fragments inside otherwise-Hindi strings.
const FF = 'Noto Sans Devanagari, Inter, Arial, sans-serif';
const W = 1080;
const H = 1080;

const DEFS = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1220"/><stop offset="0.6" stop-color="#111827"/><stop offset="1" stop-color="#3b1d06"/></linearGradient>
  <linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#d97706"/></linearGradient>
  <linearGradient id="cta" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d97706"/><stop offset="1" stop-color="#b45309"/></linearGradient>
</defs>`;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Greedy word-wrap to at most `max` characters per line, capped at `maxLines`.
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
  <line x1="80" y1="960" x2="1000" y2="960" stroke="${line}" stroke-width="2"/>
  <text x="80" y="1015" font-family="${FF}" font-size="30" fill="${meta}">${esc(handle)} · ${esc(dateLabel)}</text>
  <text x="1000" y="1015" text-anchor="end" font-family="${FF}" font-size="30" font-weight="700" fill="#fff">${slide} / ${total} ${slide < total ? '›' : ''}</text>`;
}

function coverSvg({ eyebrow, titleLines, subtitle, swipe }, total) {
  const t = titleLines.slice(0, 3);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${DEFS}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="980" cy="120" r="220" fill="#f59e0b" opacity="0.10"/>
  <circle cx="120" cy="980" r="240" fill="#14b8a6" opacity="0.08"/>
  <text x="80" y="330" font-family="${FF}" font-size="36" font-weight="700" fill="#f59e0b">${esc(eyebrow)}</text>
  ${t.map((l, i) => `<text x="80" y="${470 + i * 100}" font-family="${FF}" font-size="76" font-weight="800" fill="#fff">${esc(l)}</text>`).join('')}
  <text x="80" y="830" font-family="${FF}" font-size="38" fill="#cbd5e1">${esc(subtitle)}</text>
  <text x="80" y="895" font-family="${FF}" font-size="38" font-weight="700" fill="#f59e0b">${esc(swipe)}</text>
  <text x="1000" y="1015" text-anchor="end" font-family="${FF}" font-size="30" font-weight="700" fill="#fff">1 / ${total} ›</text>
</svg>`);
}

function contentSvg({ tag, headline, points }, slide, total) {
  const hl = wrap(headline, 18, 4);
  const pts = (points || []).slice(0, 4);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${DEFS}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="980" cy="120" r="220" fill="#f59e0b" opacity="0.10"/>
  <circle cx="120" cy="980" r="240" fill="#14b8a6" opacity="0.08"/>
  <text x="80" y="270" font-family="${FF}" font-size="32" font-weight="700" fill="#f59e0b">${esc(tag)}</text>
  ${hl.map((l, i) => `<text x="80" y="${360 + i * 82}" font-family="${FF}" font-size="64" font-weight="800" fill="#fff">${esc(l)}</text>`).join('')}
  ${pts.map((p, i) => {
    const y = 650 + i * 92;
    return `<circle cx="98" cy="${y - 13}" r="11" fill="#f59e0b"/><text x="140" y="${y}" font-family="${FF}" font-size="42" font-weight="600" fill="#e2e8f0">${esc(p)}</text>`;
  }).join('')}
  ${footerSvg(slide, total)}
</svg>`);
}

function ctaSvg({ titleLines, sub1, sub2, url }, total) {
  const t = titleLines.slice(0, 2);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${DEFS}
  <rect width="${W}" height="${H}" fill="url(#cta)"/>
  <circle cx="120" cy="140" r="220" fill="#fff" opacity="0.08"/>
  <circle cx="980" cy="960" r="240" fill="#000" opacity="0.10"/>
  ${t.map((l, i) => `<text x="80" y="${470 + i * 100}" font-family="${FF}" font-size="78" font-weight="800" fill="#fff">${esc(l)}</text>`).join('')}
  <text x="80" y="710" font-family="${FF}" font-size="40" fill="#fff7ed">${esc(sub1)}</text>
  <text x="80" y="765" font-family="${FF}" font-size="40" fill="#fff7ed">${esc(sub2)}</text>
  <rect x="80" y="830" width="560" height="90" rx="45" fill="#0b1220"/>
  <text x="360" y="888" text-anchor="middle" font-family="${FF}" font-size="40" font-weight="700" fill="#fff">${esc(url)}</text>
  <text x="1000" y="1015" text-anchor="end" font-family="${FF}" font-size="30" font-weight="700" fill="#fff">${total} / ${total}</text>
</svg>`);
}

// Composite the real logo top-left. On the amber CTA card drop a soft white
// disc behind it so the logo's own gradient stays legible.
async function brandSvg(svgBuffer, { cta = false } = {}) {
  let logo = null;
  try {
    logo = await sharp(LOGO_PATH).resize(128, 128).png().toBuffer();
  } catch (err) {
    // Logo missing (bad path) — still ship the card without it.
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
      left: 76,
    });
  }
  if (logo) layers.push({ input: logo, top: 76, left: 88 });
  return sharp(svgBuffer).composite(layers).png().toBuffer();
}

/**
 * Render a full deck to an array of PNG buffers.
 * @param {object} deck
 * @param {object} deck.cover   { eyebrow, titleLines[], subtitle, swipe }
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
    buffers.push(await brandSvg(contentSvg(cards[i], i + 2, total)));
  }
  buffers.push(await brandSvg(ctaSvg(deck.cta, total), { cta: true }));
  return buffers;
}

module.exports = { renderDeck, wrap, FF, LOGO_PATH };
