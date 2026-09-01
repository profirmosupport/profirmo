// socialNewsService — daily legal & tax news carousel for Instagram + YouTube.
//
// Flow (generateDailyPost):
//   1. fetchCandidates()  — pull recent legal/tax headlines (reuses the blog
//                           RSS fetch) → [{ title, link, source, summary }].
//   2. dedup              — drop any headline whose fingerprint already exists
//                           on a past SocialPost. NEWS IS NEVER RESHARED.
//   3. writeDeck()        — one Claude call turns 2–5 fresh items into Hindi
//                           card copy + caption + trending hashtags. When there
//                           aren't ≥2 fresh items, fall back to an evergreen
//                           "Legal Knowledge / Trusted Legal Guidance" deck
//                           (also deduped by topic).
//   4. renderDeck()       — socialCardService draws 1080×1080 PNGs (logo,
//                           Hindi, big bullets).
//   5. upload to S3       — public URLs Buffer can fetch.
//   6. SocialPost.create  — status 'draft' (default) with fingerprints stored.
//   7. optional auto-post — when social_auto_post = true, push to Buffer now.
//
// postDraft(id) pushes an existing draft to Buffer on admin approval.

const crypto = require('crypto');
const https = require('https');
const adminSettings = require('./adminSettingsService');
const storageService = require('./storageService');
const bufferService = require('./bufferService');
const socialCardService = require('./socialCardService');
const socialVideoService = require('./socialVideoService');
const aiBlogService = require('./aiBlogService');
const SocialPost = require('../models/SocialPost');

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const CONSULT_URL = 'profirmo.com/consult';

// --- Claude (self-contained; aiBlogService.callClaude isn't exported) ------

async function callClaude({ system, userMessage, maxTokens = 3000 }) {
  const [apiKey, model] = await Promise.all([
    adminSettings.getString('claude_api_key'),
    adminSettings.getString('claude_model'),
  ]);
  if (!apiKey) {
    throw { statusCode: 422, message: 'Claude API key not configured (Admin → AI / Anthropic).' };
  }
  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const detail = (json.error && (json.error.message || json.error.type)) || `HTTP ${resp.status}`;
    throw { statusCode: 502, message: `Claude API error: ${detail}` };
  }
  const text = (Array.isArray(json.content) ? json.content : [])
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return { text };
}

// --- Dedup -----------------------------------------------------------------

// Normalize a headline/topic to a stable fingerprint so the same story never
// posts twice (even with tiny wording differences). Keeps Latin + Devanagari
// letters and digits, lowercases, collapses whitespace, then hashes.
function fingerprint(text) {
  const norm = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-ॿ]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return crypto.createHash('sha1').update(norm).digest('hex');
}

// Every fingerprint we've ever posted/drafted — so nothing repeats.
async function loadUsedFingerprints() {
  const rows = await SocialPost.findAll({
    attributes: ['fingerprints'],
    where: {},
    raw: false,
  });
  const set = new Set();
  for (const r of rows) {
    for (const fp of r.fingerprints || []) set.add(fp);
  }
  return set;
}

// --- Candidates ------------------------------------------------------------

// Daily-updates sources — a spread of Indian legal + tax/finance news so the
// deck reflects the day across the web, not one outlet. Add/remove freely.
const FEEDS = [
  { name: 'LiveLaw', url: 'https://www.livelaw.in/google_feeds.xml' },
  { name: 'Bar & Bench', url: 'https://www.barandbench.com/stories.rss' },
  { name: 'LiveMint', url: 'https://www.livemint.com/rss/money' },
];

function httpGet(url, redirects = 3) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProfirmoSocialBot/1.0)' }, timeout: 15000 },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          return httpGet(next, redirects - 1).then(resolve, reject);
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }
    );
    req.on('timeout', () => req.destroy(new Error('timed out')));
    req.on('error', reject);
  });
}

function stripTags(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1] : '';
}

function parseRss(xml, source) {
  const out = [];
  const re = /<item[\s\S]*?<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const b = m[0];
    const title = stripTags(pickTag(b, 'title'));
    const link = stripTags(pickTag(b, 'link'));
    const summary = stripTags(pickTag(b, 'description')).slice(0, 300);
    const publishedAt = stripTags(pickTag(b, 'pubDate'));
    if (title) out.push({ source, title, link, summary, publishedAt });
  }
  return out;
}

// Pull the day's legal + tax headlines from every configured feed, newest
// first, de-duplicated by title.
async function fetchCandidates() {
  const perFeed = await Promise.all(
    FEEDS.map(async (f) => {
      try {
        return parseRss(await httpGet(f.url), f.name);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[socialNews] feed failed (${f.name}):`, err.message);
        return [];
      }
    })
  );
  const items = perFeed.flat();
  items.sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
  const seen = new Set();
  const uniq = [];
  for (const it of items) {
    const k = it.title.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(it);
  }
  return uniq.slice(0, 40);
}

// --- Claude decks ----------------------------------------------------------

const HI_MONTHS = [
  'जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
  'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर',
];

function hindiDate(d = new Date()) {
  return `${d.getDate()} ${HI_MONTHS[d.getMonth()]}`;
}

// Build the daily "highlights" cover. Uses Claude's hook + highlights when
// present; otherwise falls back to the day's card headlines as highlights, so
// the first slide always reflects THAT day's stories (never a fixed template).
// The eyebrow carries the date, so no two days look identical.
function buildCover(kind, cards, claudeCover) {
  const cc = claudeCover && typeof claudeCover === 'object' ? claudeCover : {};
  const eyebrowBase = kind === 'knowledge'
    ? 'भरोसेमंद कानूनी मार्गदर्शन'
    : 'आज की कानूनी व टैक्स खबरें';
  const defaultHook = kind === 'knowledge'
    ? 'ज़रूरी कानूनी जानकारी'
    : 'आज की अहम कानूनी ख़बरें';
  const fallbackHighlights = cards
    .map((c) => String(c.headline || '').trim())
    .filter(Boolean)
    .slice(0, 3);
  const highlights = (Array.isArray(cc.highlights) && cc.highlights.length
    ? cc.highlights
    : fallbackHighlights
  )
    .map((h) => String(h).replace(/\s+/g, ' ').trim().slice(0, 70))
    .filter(Boolean)
    .slice(0, 3);
  return {
    eyebrow: `${eyebrowBase} · ${hindiDate()}`,
    hook: String(cc.hook || defaultHook).slice(0, 30),
    highlights,
  };
}

const CTA_DECK = {
  titleLines: ['कोई कानूनी या', 'टैक्स मामला है?'],
  sub1: 'सत्यापित वकीलों और पेशेवरों से',
  sub2: 'निजी तौर पर बात करें।',
  url: CONSULT_URL,
};

// Ask Claude to turn fresh headlines into Hindi card copy + caption + hashtags.
async function writeNewsDeck(items, count) {
  const list = items
    .map((it, i) => `${i}. ${it.title}${it.summary ? ` — ${String(it.summary).slice(0, 200)}` : ''}`)
    .join('\n');
  const system =
    'You are a bilingual Indian legal-news editor for Profirmo, a marketplace of ' +
    'verified advocates, lawyers, CAs and tax professionals. You write short, ' +
    'accurate, plain-Hindi (Devanagari) social-carousel copy for a general Indian ' +
    'audience. Never give case-specific legal advice; summarise neutrally. Avoid ' +
    'words that read as solicitation ("best", "expert", "guaranteed"). Comply with ' +
    'BCI norms. Output STRICT JSON only, inside a ```json fenced block.';
  const user = `Here are today's candidate legal/tax headlines:\n\n${list}\n\n` +
    `Pick the ${count} MOST important and DISTINCT items (no two about the same event). ` +
    `For each, write Hindi card copy. Also write one Instagram caption (Hindi, warm, ` +
    `2–4 lines, ending by inviting people to talk to verified professionals on Profirmo) ` +
    `and 8–12 trending, relevant hashtags (mix Hindi + English, no spaces, without a leading #). ` +
    `Also write a COVER for the first slide that is unique to today — a punchy ` +
    `Hindi hook (<=30 chars, like a newspaper front-page line for the day, NOT a ` +
    `generic template) plus ${count} very short complete highlight teasers (<=30 chars each, ` +
    `one per story — the gist, not the full headline).\n` +
    `Return JSON exactly:\n` +
    `{"title":"<short english admin label>","selected":[<candidate indices you used>],` +
    `"cover":{"hook":"<hindi punchy day headline>","highlights":["<hindi teaser>","<...>"]},` +
    `"cards":[{"tag":"<short hindi source/topic tag, e.g. सुप्रीम कोर्ट>","headline":"<hindi, <=40 chars>",` +
    `"points":["<hindi bullet, a complete point <=40 chars>","<...>"]}],` +
    `"caption":"<hindi caption>","hashtags":["tag1","tag2"]}\n` +
    `Rules: 2–3 bullets per card; headline crisp; ${count} cards; the cover hook must ` +
    `reflect today's actual stories; JSON only.`;
  const { text } = await callClaude({ system, userMessage: user, maxTokens: 3000 });
  return aiBlogService.extractJson(text);
}

// Evergreen fallback when there isn't enough fresh news.
async function writeKnowledgeDeck(count, avoidTopics) {
  const avoid = (avoidTopics || []).slice(0, 40).join('; ');
  const system =
    'You are a bilingual Indian legal educator for Profirmo. You explain everyday ' +
    'legal & tax topics for ordinary Indians in simple Hindi (Devanagari). Neutral, ' +
    'accurate, no case-specific advice, no solicitation language, BCI-compliant. ' +
    'Output STRICT JSON only inside a ```json fenced block.';
  const user =
    `Create ${count} DISTINCT evergreen "legal knowledge / trusted legal guidance" ` +
    `cards useful to a general Indian audience (e.g. rights during police questioning, ` +
    `rent agreement basics, cheque bounce, consumer complaint, GST for freelancers, ` +
    `will & succession, FIR filing, tenant rights). Avoid these already-covered topics: ` +
    `${avoid || '(none yet)'}.\n` +
    `Also write a COVER for the first slide: a punchy Hindi hook (<=30 chars) plus ` +
    `${count} short complete highlight teasers (<=30 chars each, one per card topic).\n` +
    `Return JSON exactly:\n` +
    `{"title":"<short english admin label>",` +
    `"cover":{"hook":"<hindi hook>","highlights":["<hindi teaser>","<...>"]},` +
    `"cards":[{"tag":"<short hindi topic tag>","headline":"<hindi question/topic <=40 chars>",` +
    `"points":["<hindi practical complete point <=40 chars>","<...>"]}],` +
    `"caption":"<hindi caption inviting people to consult verified professionals>",` +
    `"hashtags":["tag1","tag2"]}\n` +
    `Rules: 2–3 bullets per card; ${count} cards; JSON only.`;
  const { text } = await callClaude({ system, userMessage: user, maxTokens: 3000 });
  return aiBlogService.extractJson(text);
}

// --- Rendering + upload ----------------------------------------------------

// Upload one buffer to the public store and return its absolute URL.
async function uploadPublic(buffer, mimeType, name) {
  const cfg = await storageService.getPublicConfig();
  const stored = await storageService.uploadFile({
    buffer,
    mimeType,
    originalName: name,
    type: 'blog_image', // public blog-images/ prefix
  });
  return cfg.driver === 's3' && cfg.baseUrl
    ? `${cfg.baseUrl.replace(/\/$/, '')}/${stored.key}`
    : `${(process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '')}/uploads/${stored.storedName}`;
}

async function uploadCards(buffers, slugHint) {
  const urls = [];
  for (let i = 0; i < buffers.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    urls.push(await uploadPublic(buffers[i], 'image/png', `social-${slugHint}-${i + 1}.png`));
  }
  return urls;
}

// --- Orchestrator ----------------------------------------------------------

async function generateDailyPost({ autoPost = null, logger = console } = {}) {
  const perDay = clampCount(await adminSettings.getNumber('social_posts_per_day'));
  const auto =
    autoPost == null
      ? String(await adminSettings.getString('social_auto_post')).toLowerCase() === 'true'
      : Boolean(autoPost);

  logger.log('[socialNews] step 1: fetching candidates…');
  const candidates = await fetchCandidates();
  const used = await loadUsedFingerprints();

  // Dedup: drop anything we've posted before + dedup within this pool.
  const seen = new Set();
  const fresh = [];
  for (const it of candidates) {
    const fp = fingerprint(it.title);
    if (used.has(fp) || seen.has(fp)) continue;
    seen.add(fp);
    fresh.push({ ...it, __fp: fp });
  }
  logger.log(`[socialNews] step 1 done — ${candidates.length} candidates, ${fresh.length} fresh after dedup.`);

  let kind = 'news';
  let deckJson;
  let usedItems = [];
  let fingerprints = [];

  if (fresh.length >= 2) {
    const count = Math.min(perDay, fresh.length);
    const pool = fresh.slice(0, Math.min(fresh.length, Math.max(count, 6))); // give Claude a little choice
    logger.log(`[socialNews] step 2: writing NEWS deck (${count} of ${pool.length})…`);
    deckJson = await writeNewsDeck(pool, count);
    const sel = Array.isArray(deckJson.selected) && deckJson.selected.length
      ? deckJson.selected
      : pool.map((_, i) => i).slice(0, count);
    usedItems = sel.map((i) => pool[i]).filter(Boolean);
    // Fingerprint by the SOURCE items we used + the rendered headlines, so the
    // exact story can never come back even if the feed re-lists it.
    fingerprints = usedItems.map((it) => it.__fp);
    (deckJson.cards || []).forEach((c) => fingerprints.push(fingerprint(c.headline)));
  } else {
    kind = 'knowledge';
    // Avoid repeating knowledge topics we've drafted before.
    const priorKnowledge = await SocialPost.findAll({
      attributes: ['deck'],
      where: { kind: 'knowledge' },
    });
    const avoidTopics = [];
    for (const r of priorKnowledge) {
      const d = r.deck;
      if (d && Array.isArray(d.cards)) d.cards.forEach((c) => avoidTopics.push(c.headline));
    }
    logger.log(`[socialNews] step 2: not enough fresh news — writing KNOWLEDGE deck (${perDay})…`);
    deckJson = await writeKnowledgeDeck(perDay, avoidTopics);
    fingerprints = (deckJson.cards || []).map((c) => fingerprint(c.headline));
  }

  const cards = (deckJson.cards || [])
    .filter((c) => c && c.headline)
    .map((c) => ({
      tag: String(c.tag || (kind === 'knowledge' ? 'कानूनी जानकारी' : 'खबर')).slice(0, 40),
      // Generous safety caps only — the card renderer auto-fits the full text,
      // so points/headlines are shown COMPLETE, never mid-sentence truncated.
      headline: String(c.headline).slice(0, 110),
      points: (Array.isArray(c.points) ? c.points : []).slice(0, 4).map((p) => String(p).slice(0, 160)),
    }))
    .slice(0, 5);

  if (cards.length < 1) throw { statusCode: 502, message: 'Claude returned no usable cards.' };

  const deck = { cover: buildCover(kind, cards, deckJson.cover), cards, cta: CTA_DECK };

  // Carousel images at 4:5 (1080×1350) so Instagram's feed doesn't crop them.
  logger.log(`[socialNews] step 3: rendering ${cards.length + 2} carousel cards (4:5)…`);
  const buffers = await socialCardService.renderDeck(deck, {
    height: socialCardService.CAROUSEL_H,
  });

  logger.log('[socialNews] step 4: uploading cards…');
  const slugHint = `${kind}-${new Date().toISOString().slice(0, 10)}`;
  const imageUrls = await uploadCards(buffers, slugHint);

  // Step 4b: render a 9:16 slideshow MP4 for YouTube (Short). Rendered from a
  // SECOND, taller pass so the video is full 9:16, not padded. Best-effort:
  // needs ffmpeg.
  let videoUrl = null;
  try {
    if (await socialVideoService.isAvailable()) {
      logger.log('[socialNews] step 4b: rendering 9:16 slideshow video…');
      const videoFrames = await socialCardService.renderDeck(deck, {
        height: socialCardService.VIDEO_H,
      });
      const vid = await socialVideoService.renderSlideshow(videoFrames);
      videoUrl = await uploadPublic(vid.buffer, vid.mimeType, `${slugHint}.mp4`);
      logger.log(`[socialNews] step 4b done — video ${videoUrl}`);
    } else {
      logger.warn('[socialNews] ffmpeg unavailable — YouTube video skipped.');
    }
  } catch (err) {
    logger.warn('[socialNews] video render failed (continuing without it):', err.message);
  }

  const hashtags = (Array.isArray(deckJson.hashtags) ? deckJson.hashtags : [])
    .map((h) => String(h).replace(/^#/, '').replace(/\s+/g, ''))
    .filter(Boolean)
    .slice(0, 15);

  const row = await SocialPost.create({
    kind,
    language: 'hi',
    title: String(deckJson.title || (kind === 'knowledge' ? 'Legal knowledge deck' : 'Daily legal & tax news')).slice(0, 250),
    caption: String(deckJson.caption || '').slice(0, 4000),
    hashtags,
    imageUrls,
    videoUrl,
    deck,
    fingerprints,
    sources: usedItems.map((it) => ({ title: it.title, link: it.link, source: it.source })),
    status: 'draft',
  });
  logger.log(`[socialNews] step 5: saved draft ${row.id} (${kind}, ${imageUrls.length} images).`);

  if (auto) {
    logger.log('[socialNews] step 6: auto-post enabled — pushing to Buffer…');
    try {
      await postDraft(row.id, { logger });
    } catch (err) {
      logger.warn('[socialNews] auto-post failed (draft kept):', err.message);
    }
  }
  return SocialPost.findByPk(row.id);
}

// Push an existing draft to Buffer (Instagram carousel + YouTube best-effort).
async function postDraft(id, { logger = console } = {}) {
  const row = await SocialPost.findByPk(id);
  if (!row) throw { statusCode: 404, message: 'Social post not found.' };
  if (row.status === 'posted') return row;

  // YouTube video title (<=100 chars) — Hindi, dated, so each day is distinct.
  const videoTitle = `${
    row.kind === 'knowledge' ? 'भरोसेमंद कानूनी मार्गदर्शन' : 'आज की कानूनी व टैक्स अपडेट'
  } · ${hindiDate()}`;

  const result = await bufferService.shareImageDeck({
    imageUrls: row.imageUrls,
    caption: row.caption,
    hashtags: row.hashtags,
    videoUrl: row.videoUrl || null,
    videoTitle,
  });

  if (result.skipped) {
    await row.update({ lastError: result.reason || 'Buffer skipped.' });
    throw { statusCode: 422, message: result.reason || 'Buffer not configured.' };
  }
  const posted = (result.posted || 0) > 0;
  await row.update({
    status: posted ? 'posted' : 'failed',
    postResult: result,
    postedAt: posted ? new Date() : null,
    lastError: posted ? null : (result.failures || []).map((f) => `${f.service}: ${f.error}`).join('; ') || 'No channel accepted the post.',
  });
  logger.log(`[socialNews] postDraft ${id}: posted=${result.posted}, failures=${(result.failures || []).length}`);
  return SocialPost.findByPk(id);
}

function clampCount(n) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 2) return 3;
  return Math.min(5, Math.max(2, v));
}

module.exports = {
  generateDailyPost,
  postDraft,
  fingerprint,
  fetchCandidates,
};
