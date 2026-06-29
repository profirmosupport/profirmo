// aiBlogService — four-step AI blog generator.
//
//   1. fetchTrendingTopics()    pull recent items from legal RSS feeds
//                               (LiveLaw, Bar and Bench).
//   2. pickBestTopic(topics)    one Claude call scores + picks the best
//                               topic + angle for the Profirmo audience
//                               (Indian legal + tax professionals).
//   3. draftPost(pick)          Claude generates title + slug + body
//                               HTML + SEO + OG meta.
//   4. attachFeaturedImage(p)   Pollinations.ai (free, no key) renders
//                               a featured image from the post title +
//                               excerpt; uploaded to S3.
//   5. publishAsDraft(p, url)   INSERT into blog_posts, status=draft.
//
// Orchestrator: generateBlogPostDraft() runs all five and returns the
// inserted row. Used by the admin "AI Generate" button (sync) and by
// the daily job handler (background).
//
// Image gen note: image step is best-effort — if Pollinations is down
// or returns a non-image response, the post still saves with
// featuredImage = null and the public page falls back to the site OG
// default.

const https = require('https');
const adminSettings = require('./adminSettingsService');
const pollinationsImageService = require('./pollinationsImageService');
const BlogPost = require('../models/BlogPost');
const BlogCategory = require('../models/BlogCategory');

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Vetted legal-news RSS feeds. Limited to Indian sources matching the
// platform's audience. Add more here as the editorial team validates
// them — every URL is fetched on every run so keep the list lean.
const FEEDS = [
  // Live legal news (Supreme Court, High Courts, statutory updates)
  { name: 'LiveLaw', url: 'https://www.livelaw.in/google_feeds.xml' },
  { name: 'Bar and Bench', url: 'https://www.barandbench.com/stories.rss' },
  // The Hindu's "National" feed is broader than legal but consistently
  // surfaces major statute / Supreme Court stories, so we keep it as
  // the third source — Claude scores topics for legal/tax relevance.
  { name: 'The Hindu Legal', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
];

// Soft cap on how many trending items we feed to Claude for scoring.
// Larger pools cost more tokens without obviously better picks.
const MAX_TOPICS_FOR_SCORING = 24;

// --- Claude --------------------------------------------------------------

async function getClaudeClient() {
  const [apiKey, model] = await Promise.all([
    adminSettings.getString('claude_api_key'),
    adminSettings.getString('claude_model'),
  ]);
  if (!apiKey) {
    throw {
      statusCode: 422,
      message:
        'Claude API key not configured. Set claude_api_key under Admin → AI / Anthropic.',
    };
  }
  return { apiKey, model: model || 'claude-haiku-4-5-20251001' };
}

async function callClaude({ system, userMessage, maxTokens = 4096 }) {
  const { apiKey, model } = await getClaudeClient();
  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const detail =
      (json.error && (json.error.message || json.error.type)) ||
      `HTTP ${resp.status}`;
    throw {
      statusCode: 502,
      message: `Claude API error: ${detail}`,
    };
  }
  const blocks = Array.isArray(json.content) ? json.content : [];
  const text = blocks
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return { text, model, usage: json.usage || null };
}

// Pull the first ```json …``` block out of a Claude response and parse
// it. Claude is told to wrap structured output in a fenced block so it
// survives any chatty preamble.
function extractJson(text) {
  if (!text) throw new Error('Claude returned empty response.');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  try {
    return JSON.parse(raw.trim());
  } catch (err) {
    // Defensive: try to find the first { … } in the body.
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {}
    }
    throw new Error(
      `Claude returned non-JSON output. First 300 chars: ${String(text).slice(0, 300)}`
    );
  }
}

// --- 1. Research --------------------------------------------------------

function fetchText(url, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Profirmo-AI-Blog/1.0 (+https://profirmo.com)',
          accept: '*/*',
        },
        timeout: timeoutMs,
      },
      (resp) => {
        if (resp.statusCode && resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
          // Follow redirects once.
          fetchText(resp.headers.location, { timeoutMs }).then(resolve, reject);
          return;
        }
        if (!resp.statusCode || resp.statusCode >= 400) {
          reject(new Error(`HTTP ${resp.statusCode} fetching ${url}`));
          resp.resume();
          return;
        }
        const chunks = [];
        resp.on('data', (c) => chunks.push(c));
        resp.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        resp.on('error', reject);
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error(`Timeout fetching ${url}`));
    });
    req.on('error', reject);
  });
}

// Minimal RSS / Atom parser. We only need title + link + summary +
// pubDate, so the heavy XML libraries aren't worth pulling in.
function parseRss(xml, sourceName) {
  if (!xml || typeof xml !== 'string') return [];
  // Both rss <item> and atom <entry> shapes; handle both.
  const blockRe = /<(item|entry)[\s\S]*?<\/(item|entry)>/gi;
  const out = [];
  let match;
  while ((match = blockRe.exec(xml)) !== null) {
    const block = match[0];
    const title = pickTag(block, 'title');
    const link = pickAtomLink(block) || pickTag(block, 'link');
    const summary =
      pickTag(block, 'description') ||
      pickTag(block, 'summary') ||
      pickTag(block, 'content:encoded') ||
      '';
    const pubDate =
      pickTag(block, 'pubDate') ||
      pickTag(block, 'published') ||
      pickTag(block, 'updated') ||
      '';
    if (!title) continue;
    out.push({
      source: sourceName,
      title: stripCdataAndTags(title).trim(),
      link: link.trim(),
      summary: stripCdataAndTags(summary).slice(0, 600),
      publishedAt: pubDate,
    });
  }
  return out;
}

function pickTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1] : '';
}

function pickAtomLink(xml) {
  // Atom-style: <link href="..." />
  const m = xml.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  return m ? m[1] : '';
}

function stripCdataAndTags(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchTrendingTopics() {
  const results = [];
  await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const xml = await fetchText(feed.url, { timeoutMs: 12000 });
        const items = parseRss(xml, feed.name);
        // Recency bias: take the first ~10 items per feed; RSS is
        // newest-first, so this slices the freshest cluster.
        results.push(...items.slice(0, 10));
      } catch (err) {
        console.warn(
          `[aiBlog] feed "${feed.name}" failed: ${(err && err.message) || err}`
        );
      }
    })
  );
  // Trim to a reasonable size before paying for tokens.
  return results.slice(0, MAX_TOPICS_FOR_SCORING);
}

// --- 2. Pick best topic -------------------------------------------------

async function pickBestTopic(topics) {
  if (!Array.isArray(topics) || topics.length === 0) {
    throw {
      statusCode: 502,
      message:
        'No trending topics fetched from legal RSS feeds. The feeds may be down — retry later.',
    };
  }
  // Load existing blog categories so Claude can match the topic to
  // one that already exists. If none fit, Claude proposes a new one
  // and we create it in step 3.5 (resolveCategoryId).
  const existing = await BlogCategory.findAll({
    order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    attributes: ['id', 'name', 'slug', 'description'],
  });
  const categoryBlock = existing.length
    ? existing
        .map(
          (c) =>
            `- id: ${c.id} | name: ${c.name} | slug: ${c.slug}${c.description ? ` — ${c.description}` : ''}`
        )
        .join('\n')
    : '(none yet — every topic will require a new category)';
  const numbered = topics
    .map(
      (t, i) =>
        `${i + 1}. [${t.source}] ${t.title}\n   ${t.summary || '(no summary)'}\n   URL: ${t.link}`
    )
    .join('\n\n');
  const system =
    'You are the editor-in-chief of Profirmo, a marketplace + practice-management platform for Indian legal and tax professionals (advocates, chartered accountants, company secretaries, tax consultants) and their clients. Your job is to pick the single best topic for tomorrow\'s blog post from the candidate list below.';
  const userMessage =
    'Candidate stories (today\'s legal headlines from Indian sources):\n\n' +
    numbered +
    '\n\nEXISTING BLOG CATEGORIES (use one of these if a good fit exists; otherwise propose a new one):\n' +
    categoryBlock +
    '\n\nPick ONE topic that:\n' +
    '- is timely and substantive (not a fluff piece)\n' +
    '- helps an Indian legal/tax professional explain a development to their client OR helps a client understand a legal/tax change\n' +
    '- is broad enough to write a 1000-1400-word piece on\n' +
    '- avoids overtly partisan / political angles\n' +
    '\nReturn STRICT JSON (wrapped in ```json fences) with this exact shape:\n' +
    '{\n' +
    '  "index": <1-based index of the pick from the list above>,\n' +
    '  "topic": "<short topic line, 8-12 words>",\n' +
    '  "angle": "<single sentence describing the angle the post should take>",\n' +
    '  "primaryAudience": "professional" | "client" | "both",\n' +
    '  "category": "<short category label — Litigation, Tax, GST, Corporate, Family, Property, IP, Compliance, Practice Management, etc.>",\n' +
    '  "categoryAssignment": {\n' +
    '    "matchedExistingId": "<id of an existing category from the list above if it cleanly fits, otherwise null>",\n' +
    '    "newCategory": {\n' +
    '      "name": "<title-case category name, 2-3 words>",\n' +
    '      "slug": "<kebab-case slug, ASCII, max 40 chars>",\n' +
    '      "description": "<one-sentence description shown on /blog category pages>"\n' +
    '    }\n' +
    '  },\n' +
    '  "reasoning": "<1-2 sentences on why this beats the others>"\n' +
    '}\n\n' +
    'For categoryAssignment: ALWAYS fill in either matchedExistingId (when an existing category genuinely fits) OR newCategory (when none fit). If you set matchedExistingId you can still fill newCategory with the same values for safety — but matchedExistingId wins.';
  const { text } = await callClaude({
    system,
    userMessage,
    maxTokens: 1500,
  });
  const pick = extractJson(text);
  // Stamp the original feed item so the drafter has the source URL.
  const idx =
    typeof pick.index === 'number' && pick.index >= 1 && pick.index <= topics.length
      ? pick.index - 1
      : 0;
  pick.source = topics[idx];
  return pick;
}

// Resolve the category for this pick to a concrete BlogCategory row
// id. Three branches:
//   1. Claude said matchedExistingId AND that id still exists → use it.
//   2. Claude proposed a newCategory → create it (or reuse on slug
//      collision) and use its id.
//   3. Fallback → use the post's `category` label as a name and
//      create-or-reuse by slug. Returns null only if nothing works.
async function resolveCategoryId(pick, { logger = console } = {}) {
  // Branch 1: existing id.
  const matchedId =
    pick &&
    pick.categoryAssignment &&
    pick.categoryAssignment.matchedExistingId;
  if (matchedId) {
    const row = await BlogCategory.findByPk(matchedId);
    if (row) return row.id;
    logger.warn(
      `[aiBlog] Claude picked existing categoryId=${matchedId} but it no longer exists — falling through to create.`
    );
  }

  // Branch 2: proposed new category from Claude.
  const proposed =
    pick && pick.categoryAssignment && pick.categoryAssignment.newCategory;
  if (proposed && (proposed.name || proposed.slug)) {
    const name = String(proposed.name || pick.category || 'General').trim();
    const slug = normaliseSlug(proposed.slug || name);
    const description = String(proposed.description || '').trim().slice(0, 500) || null;
    return upsertCategoryBySlug({ name, slug, description, logger });
  }

  // Branch 3: bare-label fallback.
  const label = String((pick && pick.category) || 'General').trim();
  const slug = normaliseSlug(label);
  return upsertCategoryBySlug({ name: label, slug, description: null, logger });
}

async function upsertCategoryBySlug({ name, slug, description, logger }) {
  const cleanSlug = (slug || normaliseSlug(name) || 'general').slice(0, 140);
  const existing = await BlogCategory.findOne({ where: { slug: cleanSlug } });
  if (existing) return existing.id;
  const row = await BlogCategory.create({
    name: name.slice(0, 120),
    slug: cleanSlug,
    description: description || null,
    sortOrder: 999, // sit at the bottom of the admin list until curated
  });
  logger.log(
    `[aiBlog] created new blog category — id=${row.id} name="${row.name}" slug=${row.slug}`
  );
  return row.id;
}

// --- 3. Draft full post --------------------------------------------------

async function draftPost(pick) {
  const system =
    'You are a senior legal writer for Profirmo. Voice: clear, practical, non-sensational. ' +
    'Audience: Indian legal & tax professionals + their clients. ' +
    'Always: cite the specific Act / section / case number when relevant; never invent facts. ' +
    'House style: short paragraphs (3-4 sentences), descriptive H2s, no clickbait. ' +
    'Length: 1000-1400 words.';

  const userMessage =
    'Write a blog post on this topic.\n\n' +
    `TOPIC: ${pick.topic}\n` +
    `ANGLE: ${pick.angle}\n` +
    `CATEGORY: ${pick.category || 'Compliance'}\n` +
    `PRIMARY AUDIENCE: ${pick.primaryAudience || 'both'}\n` +
    `SOURCE STORY (for context, do NOT just rehash): ${pick.source && pick.source.title}\n` +
    `SOURCE URL: ${pick.source && pick.source.link}\n\n` +
    'Return STRICT JSON (wrapped in ```json fences) with this exact shape:\n' +
    '{\n' +
    '  "title": "<55-70 chars, no clickbait, no all-caps>",\n' +
    '  "slug": "<kebab-case, ASCII, max 90 chars, no trailing dash>",\n' +
    '  "excerpt": "<140-220 char summary for listing cards + meta-description fallback>",\n' +
    '  "contentHtml": "<full body. Plain semantic HTML only: <p>, <h2>, <h3>, <ul><li>, <ol><li>, <blockquote>, <strong>, <em>, <a href=\\\"...\\\">. No <script>, <style>, no inline event handlers. Open with a 1-2 paragraph hook, then 3-5 H2 sections, end with a short takeaway. Cite Acts/sections inline.>",\n' +
    '  "seoTitle": "<<= 65 chars, includes the primary keyword naturally>",\n' +
    '  "seoDescription": "<<= 160 chars, distinct from excerpt, action-oriented>",\n' +
    '  "ogTitle": "<<= 70 chars, can mirror seoTitle>",\n' +
    '  "ogDescription": "<<= 200 chars, more conversational than seoDescription>",\n' +
    '  "tags": ["<3-6 lowercase tags, no spaces, kebab-case>"],\n' +
    '  "readingMinutes": <integer estimate based on ~220 wpm>\n' +
    '}';

  const { text } = await callClaude({
    system,
    userMessage,
    maxTokens: 8000,
  });
  const draft = extractJson(text);
  // Server-side hardening: sanity-check the fields, fix obvious slugs.
  draft.title = String(draft.title || pick.topic).trim().slice(0, 250);
  draft.slug = normaliseSlug(draft.slug || draft.title);
  draft.excerpt = String(draft.excerpt || '').trim().slice(0, 500);
  draft.contentHtml = String(draft.contentHtml || '').trim();
  draft.seoTitle = String(draft.seoTitle || draft.title).trim().slice(0, 255);
  draft.seoDescription = String(draft.seoDescription || draft.excerpt).trim().slice(0, 500);
  draft.ogTitle = String(draft.ogTitle || draft.seoTitle).trim().slice(0, 255);
  draft.ogDescription = String(draft.ogDescription || draft.seoDescription).trim().slice(0, 500);
  draft.tags = Array.isArray(draft.tags)
    ? draft.tags
        .map((t) => String(t || '').toLowerCase().trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];
  draft.readingMinutes = Math.max(
    1,
    Math.min(30, Number(draft.readingMinutes) || estimateReadingMinutes(draft.contentHtml))
  );
  return draft;
}

function normaliseSlug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
    .replace(/-+$/g, '');
}

function estimateReadingMinutes(html) {
  const words = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

// --- 4. Image: Pollinations.ai (free, no API key) → S3 -----------------

// Best-effort featured-image attachment. NEVER throws — blog
// generation must succeed even if the image step fails (Pollinations
// occasionally times out on cold starts). Returns
// { url, attribution, source } where attribution is always null
// (Pollinations doesn't require credit) and source is 'pollinations'
// when an image was produced.
async function attachFeaturedImage(draft) {
  try {
    const gen = await pollinationsImageService.generateAndStoreBlogImage({
      title: draft.title,
      excerpt: draft.excerpt,
    });
    return { url: gen.url, attribution: null, source: 'pollinations' };
  } catch (err) {
    console.warn(
      '[aiBlog] Pollinations image generation failed (continuing without image):',
      err.message
    );
    return { url: null, attribution: null, source: null };
  }
}

// Generate a fresh featured image for an EXISTING blog post. Used by
// the "Generate with AI" button on the admin edit page. Updates
// featuredImage + ogImage in one shot. Throws on failure so the
// caller can surface the message in a toast.
async function regenerateImageForPost(postId) {
  const post = await BlogPost.findByPk(postId);
  if (!post) throw { statusCode: 404, message: 'Blog post not found.' };
  const gen = await pollinationsImageService.generateAndStoreBlogImage({
    title: post.title,
    excerpt: post.excerpt,
  });
  await post.update({ featuredImage: gen.url, ogImage: gen.url });
  return {
    url: gen.url,
    source: 'pollinations',
    prompt: gen.prompt,
  };
}

// --- 5. Persist as draft -------------------------------------------------

async function ensureUniqueSlug(baseSlug) {
  let slug = baseSlug || `post-${Date.now()}`;
  let suffix = 0;
  // Defensive cap so a buggy generator can't loop forever.
  while (suffix < 50) {
    const found = await BlogPost.findOne({ where: { slug } });
    if (!found) return slug;
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
  return `${baseSlug}-${Date.now()}`;
}

async function publishAsDraft(draft, image, authorUserId = null, categoryId = null) {
  const slug = await ensureUniqueSlug(draft.slug);
  const row = await BlogPost.create({
    id: `blog-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    title: draft.title,
    slug,
    excerpt: draft.excerpt,
    content: appendAttribution(draft.contentHtml, image && image.attribution),
    featuredImage: (image && image.url) || null,
    categoryId: categoryId || null,
    tagIds: null,
    authorUserId,
    authorName: 'Profirmo AI Desk',
    status: 'draft',
    publishedAt: null,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    ogTitle: draft.ogTitle,
    ogDescription: draft.ogDescription,
    ogImage: (image && image.url) || null,
    readingMinutes: draft.readingMinutes,
  });
  return row.get({ plain: true });
}

function appendAttribution(html, attribution) {
  if (!attribution) return html;
  return (
    String(html || '') +
    `\n<p style="margin-top:24px;font-size:12px;color:#94a3b8;">` +
    `<em>${escapeHtml(attribution)}.</em></p>`
  );
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- Orchestrator --------------------------------------------------------

async function generateBlogPostDraft({ authorUserId = null, logger = console } = {}) {
  const startedAt = Date.now();
  logger.log('[aiBlog] step 1: fetching trending topics…');
  const topics = await fetchTrendingTopics();
  logger.log(`[aiBlog] step 1 done — ${topics.length} candidate(s)`);

  logger.log('[aiBlog] step 2: picking best topic via Claude…');
  const pick = await pickBestTopic(topics);
  logger.log(
    `[aiBlog] step 2 done — chose #${pick.index} ("${pick.topic}") because: ${pick.reasoning}`
  );

  logger.log('[aiBlog] step 3: drafting post via Claude…');
  const draft = await draftPost(pick);
  logger.log(
    `[aiBlog] step 3 done — title="${draft.title}", slug=${draft.slug}, ~${draft.readingMinutes}min read`
  );

  logger.log('[aiBlog] step 3.5: resolving category…');
  let categoryId = null;
  try {
    categoryId = await resolveCategoryId(pick, { logger });
    logger.log(`[aiBlog] step 3.5 done — categoryId=${categoryId}`);
  } catch (err) {
    logger.warn(
      '[aiBlog] category resolution failed (continuing without one):',
      err.message
    );
  }

  logger.log('[aiBlog] step 4: attaching featured image (Pollinations)…');
  let image = { url: null, attribution: null };
  try {
    image = await attachFeaturedImage(draft);
  } catch (err) {
    logger.warn('[aiBlog] image step failed (continuing):', err.message);
  }
  logger.log(
    image.url
      ? `[aiBlog] step 4 done — image: ${image.url}`
      : '[aiBlog] step 4 done — no image (continuing)'
  );

  logger.log('[aiBlog] step 5: saving as draft…');
  const row = await publishAsDraft(draft, image, authorUserId, categoryId);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  logger.log(
    `[aiBlog] DONE in ${elapsed}s — id=${row.id} status=draft slug=${row.slug}`
  );
  return {
    post: row,
    pick,
    image,
    elapsedSeconds: Number(elapsed),
  };
}

module.exports = {
  // Public orchestrator + step functions exposed for unit tests.
  generateBlogPostDraft,
  fetchTrendingTopics,
  pickBestTopic,
  resolveCategoryId,
  draftPost,
  attachFeaturedImage,
  publishAsDraft,
  regenerateImageForPost,
  // helpers
  normaliseSlug,
  extractJson,
};
