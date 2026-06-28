// Next.js App Router convention — exports a robots() function that is
// served as /robots.txt. The `Sitemap:` line points crawlers at the
// dynamic sitemap.xml so new professionals + blog posts get indexed
// on the next crawl without any manual submission.
//
// Auth, admin, and dashboard routes are disallowed because they're
// gated and noisy in search results.

function resolveSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    'https://profirmo.com'
  );
}

// Auth/admin/dashboard prefixes are off-limits to every bot. Defined once
// so the AI-crawler rules below can reuse the same list.
const DISALLOW_PRIVATE = [
  '/admin',
  '/admin/',
  '/api',
  '/api/',
  '/dashboard',
  '/dashboard/',
  '/login',
  '/auth',
  '/_next',
  '/booking/',
  '/payments/',
];

// AI-assistant crawlers we explicitly welcome — being listed here is what
// makes Profirmo content eligible to appear in ChatGPT / Claude / Gemini /
// Perplexity answers. Each one is granted the same surface as Googlebot;
// we just keep them out of private routes.
const AI_CRAWLERS_ALLOW = [
  'GPTBot',          // OpenAI training corpus
  'OAI-SearchBot',   // ChatGPT live search
  'ChatGPT-User',    // ChatGPT browsing plugin (user-initiated)
  'ClaudeBot',       // Anthropic training corpus
  'Claude-Web',      // Claude live search
  'anthropic-ai',    // Older Anthropic UA
  'Google-Extended', // Gemini training (separate from regular Googlebot)
  'PerplexityBot',   // Perplexity AI
  'CCBot',           // Common Crawl — feeds many training sets
  'Applebot-Extended', // Apple Intelligence training
  'cohere-ai',       // Cohere
  'YouBot',          // You.com
  'Bingbot',         // Bing index — powers Copilot + ChatGPT search
];

// AI scrapers we choose NOT to feed. Bytespider in particular has a
// reputation for ignoring robots.txt and hammering origins.
const AI_CRAWLERS_DISALLOW = ['Bytespider'];

export default function robots() {
  const site = resolveSiteUrl().replace(/\/$/, '');

  const aiAllowRules = AI_CRAWLERS_ALLOW.map((ua) => ({
    userAgent: ua,
    allow: '/',
    disallow: DISALLOW_PRIVATE,
  }));

  const aiDisallowRules = AI_CRAWLERS_DISALLOW.map((ua) => ({
    userAgent: ua,
    disallow: '/',
  }));

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOW_PRIVATE,
      },
      ...aiAllowRules,
      ...aiDisallowRules,
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
