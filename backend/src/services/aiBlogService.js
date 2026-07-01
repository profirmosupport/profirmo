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
//   5. publishAsDraft(p, url)   INSERT into blog_posts, status=published,
//                               authorName="Advocate Rajiv Shukla".
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
const BlogTag = require('../models/BlogTag');
const bufferService = require('./bufferService');

// Public URL pattern for a blog post. Used to build the "Read more"
// link Buffer shares on every connected social profile. Override via
// PUBLIC_BLOG_URL_PREFIX if you ever move the marketing site.
const PUBLIC_BLOG_URL_PREFIX =
  process.env.PUBLIC_BLOG_URL_PREFIX || 'https://profirmo.com/blog/';

function blogPostPublicUrl(slug) {
  return `${PUBLIC_BLOG_URL_PREFIX.replace(/\/$/, '/')}${encodeURIComponent(
    slug
  )}`;
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Byline used for every AI-generated blog post. Also serves as the
// "skip if recent post exists" marker in the daily job handler, so a
// human writing a post under the same name is intentionally fine.
const AI_AUTHOR_NAME = 'Advocate Rajiv Shukla';

// Source: LiveLaw only. The editor asked us to focus on livelaw.in for
// the daily topic — every candidate for the daily post comes from
// this single Indian legal-news feed. Bar and Bench + The Hindu
// National were dropped so a single site's editorial voice sets the
// beat.
const FEEDS = [
  { name: 'LiveLaw', url: 'https://www.livelaw.in/google_feeds.xml' },
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

// Pull a JSON object out of a Claude response.
// Claude is told to wrap structured output in a ```json …``` block, but
// when the output approaches the max_tokens budget the model can be cut
// off mid-string — leaving us with an *opening* fence and an incomplete
// body but no closing fence and no closing braces. We try, in order:
//   1. Closed fenced block (the happy path).
//   2. Opening fence with no close — parse everything after it.
//   3. Bare body (no fence) — parse as-is.
//   4. First balanced { … } object in the text.
//   5. As a last resort, attempt to close any unclosed strings + braces
//      and parse the salvaged JSON. Better to recover a partial draft
//      than to fail the whole AI-Generate flow on a truncated tail.
function extractJson(text) {
  if (!text) throw new Error('Claude returned empty response.');

  // 1. Fully-fenced block.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {}
  }

  // 2. Opening fence, no closer — parse everything after the fence.
  const open = text.match(/```(?:json)?\s*([\s\S]*)$/i);
  const candidate = open ? open[1] : text;

  // 3. Try the candidate body directly.
  try {
    return JSON.parse(candidate.trim());
  } catch {}

  // 4. First balanced object in the candidate.
  const balanced = matchBalancedObject(candidate);
  if (balanced) {
    try {
      return JSON.parse(balanced);
    } catch {}
  }

  // 5. Last-ditch repair: try to close any unterminated string + braces.
  const repaired = repairTruncatedJson(candidate);
  if (repaired) {
    try {
      return JSON.parse(repaired);
    } catch {}
  }

  throw new Error(
    `Claude returned non-JSON output. First 300 chars: ${String(text).slice(0, 300)}`
  );
}

// Walks the string and returns the first { … } object whose braces
// balance (ignoring braces inside strings). Returns null if no
// balanced object is found.
function matchBalancedObject(s) {
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch === '\\') {
        esc = true;
      } else if (ch === '"') {
        inStr = false;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

// Salvage a truncated JSON object by truncating at the last comma we
// saw at top-level (where the prior field is complete and we're
// guaranteed not inside a string), then closing the open brace(s).
// The recovered value will be missing whatever fields came after the
// truncation point — the AI Blog flow tolerates that (sanitises
// every field on read).
function repairTruncatedJson(s) {
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  let lastSafeEnd = -1; // index of the last `,` seen at depth 1, not inside a string
  let depthAtSafe = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch === '\\') {
        esc = true;
      } else if (ch === '"') {
        inStr = false;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return null;
      } // already balanced — matchBalancedObject would have caught it
    } else if (ch === ',' && depth === 1) {
      // A comma at the top object level — a safe place to truncate
      // because every field-pair before it is complete and we're
      // guaranteed not inside a string.
      lastSafeEnd = i;
      depthAtSafe = depth;
    }
  }
  if (lastSafeEnd < 0) return null;
  // Truncate strictly BEFORE the comma so the result is a valid
  // object body. Close enough `}` to balance the depth that was
  // open at the safe point.
  const core = s.slice(start, lastSafeEnd);
  return core + '}'.repeat(depthAtSafe);
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

// Pull the last N blog titles + slugs off the platform so the AI
// pipeline can avoid picking a topic (or writing under a title) that
// duplicates something we've already covered. Newest first.
async function loadRecentTitles(limit = 40) {
  const rows = await BlogPost.findAll({
    order: [['createdAt', 'DESC']],
    limit,
    attributes: ['title', 'slug'],
  });
  return rows.map((r) => ({ title: r.title, slug: r.slug }));
}

// Does this draft duplicate an existing post? Match on slug exact
// (the platform enforces slug uniqueness anyway) OR title compared
// case-insensitively after punctuation strip. Returns the colliding
// row's { title, slug } on hit, null otherwise.
async function findTitleCollision(draft) {
  const draftSlug = normaliseSlug(draft.slug || draft.title);
  const draftTitleKey = titleMatchKey(draft.title);
  const rows = await BlogPost.findAll({
    attributes: ['title', 'slug'],
  });
  for (const r of rows) {
    if (r.slug === draftSlug) return { title: r.title, slug: r.slug };
    if (titleMatchKey(r.title) === draftTitleKey) {
      return { title: r.title, slug: r.slug };
    }
  }
  return null;
}

// Normalise a title for fuzzy compare: lowercase, strip punctuation,
// collapse whitespace. Not a full similarity metric — just enough to
// catch "The X judgment" vs "the-x judgment!" kind of collisions.
function titleMatchKey(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
  const recentTitles = await loadRecentTitles(40);
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
  const alreadyPostedBlock = recentTitles.length
    ? recentTitles.map((t, i) => `${i + 1}. ${t.title}`).join('\n')
    : '(none)';
  const userMessage =
    'Candidate stories from LiveLaw:\n\n' +
    numbered +
    '\n\nEXISTING BLOG CATEGORIES (use one of these if a good fit exists; otherwise propose a new one):\n' +
    categoryBlock +
    '\n\nPOSTS WE ALREADY PUBLISHED (do NOT pick a candidate that overlaps with any of these — same case, same statute, same angle):\n' +
    alreadyPostedBlock +
    '\n\nPick ONE topic that:\n' +
    '- is timely and substantive (not a fluff piece)\n' +
    '- helps an Indian legal/tax professional explain a development to their client OR helps a client understand a legal/tax change\n' +
    '- is broad enough to write a 1000-1400-word piece on\n' +
    '- avoids overtly partisan / political angles\n' +
    '- does NOT duplicate any of the published posts above (skip candidates that would\n' +
    '  produce a near-identical title or cover the same case/statute we already covered)\n' +
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

// Resolve the draft.tags array (Claude returns these as
// lower-case kebab-case strings, see draftPost JSON schema) into
// concrete BlogTag row ids. Find-or-create by slug — never throws on
// individual failures; logs and continues so a single broken slug
// doesn't lose all the tags.
async function resolveTagIds(tagInputs, { logger = console } = {}) {
  if (!Array.isArray(tagInputs) || tagInputs.length === 0) return [];
  const ids = [];
  const seenSlugs = new Set();
  for (const raw of tagInputs) {
    const original = String(raw || '').trim();
    if (!original) continue;
    // Claude sometimes emits "kebab-case" tags and sometimes "Title Case";
    // normalise to a slug, derive a display name by replacing dashes
    // with spaces and title-casing.
    const slug = normaliseSlug(original).slice(0, 100);
    if (!slug || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    const name = original
      .replace(/-+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .slice(0, 80);
    try {
      const existing = await BlogTag.findOne({ where: { slug } });
      if (existing) {
        ids.push(existing.id);
        continue;
      }
      const created = await BlogTag.create({ name, slug });
      logger.log(
        `[aiBlog] created new blog tag — id=${created.id} name="${created.name}" slug=${created.slug}`
      );
      ids.push(created.id);
    } catch (err) {
      logger.warn(
        `[aiBlog] tag upsert failed for slug="${slug}" (continuing): ${err.message}`
      );
    }
  }
  return ids;
}

// --- 3. Draft full post --------------------------------------------------

async function draftPost(pick, { avoidTitles = [] } = {}) {
  // Voice guide: warm, plain-English, first-person-plural, not a
  // dry law-firm bulletin. Claude tends to slip into stiff Legal
  // Prose by default — the guide explicitly discourages that.
  const system =
    'You are a legal writer for Profirmo — an Indian legal/tax marketplace. ' +
    'Voice: warm, plain-English, conversational — like a friendly senior colleague ' +
    'explaining a judgment over coffee. Not a law-firm bulletin. Not a press release.\n\n' +
    'RULES:\n' +
    '- Address the reader as "you" throughout. Use "we" for the profession/platform.\n' +
    '- Open with a real-world hook (a 2-3 sentence scenario or a striking sentence). ' +
    'Never open with "In a recent judgment…" or "The Court held…".\n' +
    '- Short sentences. Everyday words. When a legal term is unavoidable, define it ' +
    'in the same paragraph in plain English.\n' +
    '- Cite the specific Act / section / case name inline where relevant — but never ' +
    'invent facts. If the source is thin, keep the article tighter.\n' +
    '- Use concrete Indian examples ("₹15,000 rent", "a Bengaluru startup", "a Class II ' +
    'employee") rather than abstract legal hypotheticals.\n' +
    '- 3-5 H2 sections. Descriptive H2s (not "Introduction", "Conclusion"). Bullet lists ' +
    'where they help; not everywhere.\n' +
    '- End with a short, human takeaway paragraph — what should the reader actually DO.\n' +
    '- Length: 1000-1400 words. Never pad.';

  const avoidBlock = Array.isArray(avoidTitles) && avoidTitles.length
    ? avoidTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')
    : '(none)';

  const userMessage =
    'Write a blog post on this topic.\n\n' +
    `TOPIC: ${pick.topic}\n` +
    `ANGLE: ${pick.angle}\n` +
    `CATEGORY: ${pick.category || 'Compliance'}\n` +
    `PRIMARY AUDIENCE: ${pick.primaryAudience || 'both'}\n` +
    `SOURCE STORY (for context, do NOT just rehash): ${pick.source && pick.source.title}\n` +
    `SOURCE URL: ${pick.source && pick.source.link}\n\n` +
    'TITLES WE HAVE ALREADY PUBLISHED — your title MUST NOT match or read as a ' +
    'near-paraphrase of any of these. Pick a genuinely fresh phrasing/angle:\n' +
    avoidBlock +
    '\n\nReturn STRICT JSON (wrapped in ```json fences) with this exact shape:\n' +
    '{\n' +
    '  "title": "<55-70 chars. Human, hook-y, not clickbait. NEVER duplicates any of the already-published titles above. Prefer a specific noun or scenario over a generic label.>",\n' +
    '  "slug": "<kebab-case, ASCII, max 90 chars, no trailing dash>",\n' +
    '  "excerpt": "<140-220 char summary. Sounds like a person, not a law journal. First-person-plural where natural (\'here\'s what changes for you\').>",\n' +
    '  "contentHtml": "<full body in plain semantic HTML: <p>, <h2>, <h3>, <ul><li>, <ol><li>, <blockquote>, <strong>, <em>, <a href=\\\"...\\\">. No <script>, <style>, no inline event handlers. Follow the voice rules in the system prompt.>",\n' +
    '  "imagePrompt": "<A 1-2 sentence VISUAL scene description for the featured photo. Concrete Indian imagery relevant to THIS post specifically (not generic law-book stock). Format as a photo-style prompt: subject, setting, lighting, mood. Example: \'A young woman consulting an advocate at a wooden desk in a Kolkata chambers, papers spread out, warm afternoon window light, quiet mood.\'>",\n' +
    '  "seoTitle": "<<= 65 chars, includes the primary keyword naturally>",\n' +
    '  "seoDescription": "<<= 160 chars, distinct from excerpt, action-oriented>",\n' +
    '  "ogTitle": "<<= 70 chars, can mirror seoTitle>",\n' +
    '  "ogDescription": "<<= 200 chars, more conversational than seoDescription>",\n' +
    '  "tags": ["<3-6 lowercase tags, no spaces, kebab-case>"],\n' +
    '  "readingMinutes": <integer estimate based on ~220 wpm>\n' +
    '}';

  // 16K output budget: a 1400-word body in <p>/<h2>/<li> markup is
  // ~5K tokens; SEO + OG + tags + JSON wrapper adds another ~1K.
  // Earlier 8K cap was being hit when Claude wrote on the long end
  // of the band, producing a truncated tail with no closing fence
  // and triggering extractJson's "non-JSON output" error.
  const { text } = await callClaude({
    system,
    userMessage,
    maxTokens: 16000,
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
  // Cap the image prompt at a length Pollinations can encode into a
  // URL path comfortably (their server truncates around 2000 chars
  // anyway). Empty is fine — attachFeaturedImage falls back to the
  // deterministic scene anchor when imagePrompt is missing.
  draft.imagePrompt = String(draft.imagePrompt || '').trim().slice(0, 500);
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
      // Claude writes a bespoke visual-scene description per article
      // in the draftPost JSON. When present it wins over the
      // deterministic scene-anchor keyword map; when absent the
      // service falls back to its default builder.
      customPrompt: draft.imagePrompt || null,
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

async function publishAsDraft(
  draft,
  image,
  authorUserId = null,
  categoryId = null,
  tagIds = null
) {
  const slug = await ensureUniqueSlug(draft.slug);
  const row = await BlogPost.create({
    id: `blog-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    title: draft.title,
    slug,
    excerpt: draft.excerpt,
    content: appendAttribution(draft.contentHtml, image && image.attribution),
    featuredImage: (image && image.url) || null,
    categoryId: categoryId || null,
    tagIds: Array.isArray(tagIds) && tagIds.length ? tagIds : null,
    authorUserId,
    authorName: AI_AUTHOR_NAME,
    status: 'published',
    publishedAt: new Date(),
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
  const avoidTitles = (await loadRecentTitles(40)).map((r) => r.title);
  // First draft. If Claude accidentally hands back a title or slug
  // that collides with a live post, we re-prompt once with a
  // stronger "avoid these" list. Rare but happens when the news
  // cycle repeats a similar Supreme Court angle two days running.
  let draft = await draftPost(pick, { avoidTitles });
  const collision = await findTitleCollision(draft);
  if (collision) {
    logger.warn(
      `[aiBlog] step 3 collision — title/slug matches "${collision.title}" (${collision.slug}); retrying draft with stronger avoid list.`
    );
    draft = await draftPost(pick, {
      avoidTitles: [collision.title, ...avoidTitles],
    });
    const stillColliding = await findTitleCollision(draft);
    if (stillColliding) {
      // Give up on retry — mutate the title with a differentiator so
      // the post still ships. ensureUniqueSlug will handle the slug.
      draft.title = `${draft.title} (fresh take)`.slice(0, 250);
      logger.warn(
        `[aiBlog] step 3 double-collision — appending " (fresh take)" to title to force uniqueness.`
      );
    }
  }
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

  logger.log('[aiBlog] step 3.6: resolving tags…');
  let tagIds = [];
  try {
    tagIds = await resolveTagIds(draft.tags, { logger });
    logger.log(
      `[aiBlog] step 3.6 done — ${tagIds.length} tag(s): ${tagIds.join(', ') || '(none)'}`
    );
  } catch (err) {
    logger.warn(
      '[aiBlog] tag resolution failed (continuing without tags):',
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

  logger.log('[aiBlog] step 5: publishing post…');
  const row = await publishAsDraft(draft, image, authorUserId, categoryId, tagIds);

  // Step 6: share to Buffer. Best-effort — failures (network error,
  // Buffer down, token revoked, no linked profiles) are logged and
  // we still return a successful post creation.
  let bufferResult = null;
  try {
    logger.log('[aiBlog] step 6: sharing to Buffer…');
    bufferResult = await bufferService.shareBlogPost({
      title: row.title,
      excerpt: row.excerpt,
      url: blogPostPublicUrl(row.slug),
      imageUrl: row.featuredImage,
      tags: draft.tags,
    });
    if (bufferResult && bufferResult.skipped) {
      logger.log(`[aiBlog] step 6 skipped — ${bufferResult.reason}`);
    } else {
      logger.log(
        `[aiBlog] step 6 done — shared to ${bufferResult.posted}/${bufferResult.profileIds.length} Buffer profile(s)`
      );
    }
  } catch (err) {
    logger.warn(
      '[aiBlog] Buffer share failed (post still published):',
      err.message
    );
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  logger.log(
    `[aiBlog] DONE in ${elapsed}s — id=${row.id} status=${row.status} slug=${row.slug}`
  );
  return {
    post: row,
    pick,
    image,
    buffer: bufferResult,
    elapsedSeconds: Number(elapsed),
  };
}

module.exports = {
  // Public orchestrator + step functions exposed for unit tests.
  generateBlogPostDraft,
  fetchTrendingTopics,
  pickBestTopic,
  resolveCategoryId,
  resolveTagIds,
  draftPost,
  attachFeaturedImage,
  publishAsDraft,
  regenerateImageForPost,
  // helpers
  normaliseSlug,
  extractJson,
  // constants
  AI_AUTHOR_NAME,
};
