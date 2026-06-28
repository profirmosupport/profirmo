// Dynamic sitemap served by Next.js at /sitemap.xml. Google + other
// crawlers consume this; the human-readable variant lives at
// /sitemap (linked in the footer next to Terms & Conditions).
//
// Pulls live data from the backend so newly-added professionals,
// blog posts, and featured cities surface in the next crawl without
// any rebuild.

// EC2 + nginx + LE at proapi.profirmo.com (was profirmo.onrender.com).
const PRODUCTION_API_URL = 'https://proapi.profirmo.com';

function resolveApiBaseUrl() {
  if (process.env.API_BACKEND_URL) return process.env.API_BACKEND_URL;
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return PRODUCTION_API_URL;
  }
  return 'http://localhost:5001';
}

function resolveSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    'https://profirmo.com'
  );
}

async function fetchJson(path) {
  try {
    const res = await fetch(`${resolveApiBaseUrl()}${path}`, {
      // Cache for an hour — sitemap re-generates on next request after
      // the window expires, so newly-added rows show up within ~60 min.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body && (body.data || body);
  } catch {
    return null;
  }
}

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Static routes that always exist. Listed explicitly so we don't have
// to crawl the app/ directory. Grouped by category (strategy §8 — split
// the sitemap by page type so we can monitor index health per group).
const STATIC_ROUTES = [
  // Brand / shell
  { path: '/', priority: 1.0, changeFrequency: 'daily', group: 'shell' },
  { path: '/about', priority: 0.5, changeFrequency: 'monthly', group: 'shell' },
  { path: '/how-it-works', priority: 0.6, changeFrequency: 'monthly', group: 'shell' },
  { path: '/pricing', priority: 0.7, changeFrequency: 'weekly', group: 'shell' },
  { path: '/contact', priority: 0.5, changeFrequency: 'monthly', group: 'shell' },
  { path: '/ecourts', priority: 0.7, changeFrequency: 'weekly', group: 'shell' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly', group: 'shell' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly', group: 'shell' },
  { path: '/sitemap', priority: 0.4, changeFrequency: 'weekly', group: 'shell' },
  // Directories
  { path: '/professionals', priority: 0.9, changeFrequency: 'daily', group: 'directory' },
  { path: '/firms', priority: 0.85, changeFrequency: 'daily', group: 'directory' },
  { path: '/search', priority: 0.6, changeFrequency: 'weekly', group: 'directory' },
  // Content hubs
  { path: '/blog', priority: 0.8, changeFrequency: 'daily', group: 'content' },
  { path: '/resources', priority: 0.8, changeFrequency: 'weekly', group: 'content' },
  // Services hub + low-risk pillars (strategy §1 / §4)
  { path: '/services', priority: 0.9, changeFrequency: 'weekly', group: 'services' },
  { path: '/services/gst-consultation', priority: 0.9, changeFrequency: 'weekly', group: 'services' },
  { path: '/services/income-tax-itr', priority: 0.9, changeFrequency: 'weekly', group: 'services' },
  { path: '/services/company-registration-and-roc', priority: 0.9, changeFrequency: 'weekly', group: 'services' },
  { path: '/services/startup-compliance', priority: 0.9, changeFrequency: 'weekly', group: 'services' },
  // Free tools
  { path: '/tools/gst-calculator', priority: 0.7, changeFrequency: 'monthly', group: 'tools' },
  // Hindi / hreflang variants — listed explicitly so Google sees them.
  { path: '/hi/services/gst-consultation', priority: 0.7, changeFrequency: 'weekly', group: 'i18n' },
  // Supply-side
  { path: '/for-professionals', priority: 0.6, changeFrequency: 'monthly', group: 'supply' },
  { path: '/join-team', priority: 0.6, changeFrequency: 'monthly', group: 'supply' },
  // Auth (low priority but indexable)
  { path: '/signup', priority: 0.6, changeFrequency: 'monthly', group: 'auth' },
  { path: '/login', priority: 0.3, changeFrequency: 'yearly', group: 'auth' },
];

// Strategy §1 / A1: advocate-tier service landings are kept indexable as
// INFORMATION pages but get a lower priority weight to signal they are
// not the primary conversion path. They are NOT excluded from the
// sitemap because they're real, useful, info pages.
const SERVICE_LANDING_SLUGS = [
  // low-risk conversion landings
  'gst-notice-consultation',
  'income-tax-filing-help',
  'company-registration',
  'trademark-consultation',
  'rental-agreement-drafting',
  'business-contract-review',
  'tax-notice-help',
  'startup-legal-consultation',
  // advocate-tier "information" pages (kept indexable, lower priority)
  'property-dispute-consultation',
  'divorce-and-family-consultation',
  'legal-notice-drafting',
  'cheque-bounce-matter',
  'consumer-complaint-consultation',
  'employment-and-salary-dispute',
  'nri-property-legal-help',
];

// Lawyer detection — mirror frontend/utils/seo.js#isLawyer.
function isAdvocate(p) {
  const t = String((p && p.professionalType) || '').toLowerCase();
  if (t.includes('lawyer') || t.includes('advocate') || t.includes('legal')) {
    return true;
  }
  return !!(p && (p.barRegistrationNumber || (p.lawyer && p.lawyer.barRegistrationNumber)));
}

export default async function sitemap() {
  const SITE = resolveSiteUrl().replace(/\/$/, '');
  const now = new Date();

  const entries = STATIC_ROUTES.map((r) => ({
    url: `${SITE}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // Service-landing pages — strategy §4. The 15 entries cover both
  // low-risk conversion landings and advocate-tier "information" pages.
  for (const slug of SERVICE_LANDING_SLUGS) {
    entries.push({
      url: `${SITE}/services/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      // Advocate-tier info pages get a lower weight than the low-risk
      // commercial landings; both stay in the index.
      priority: slug.endsWith('-consultation') || slug.endsWith('-help') ||
                slug.endsWith('-review') || slug.endsWith('-drafting') ||
                slug === 'company-registration' || slug === 'startup-legal-consultation'
        ? 0.7
        : 0.55,
    });
  }

  // Professionals — paginate up to 5000 to keep the sitemap under
  // Google's 50k-URL / 50 MB ceiling. Per the latest product call,
  // advocates ARE included in the sitemap so they're discoverable by
  // crawlers and users; the individual profile page still emits
  // noindex,nofollow (see app/professionals/[id]/page.js). Net effect:
  // Google crawls the URL but does not index the profile, while users
  // who arrive via direct link / sitemap browse can still see it.
  // Advocates get a lower sitemap priority to signal lower SEO weight.
  const proListing = await fetchJson('/api/professionals?limit=5000');
  if (proListing && Array.isArray(proListing)) {
    for (const p of proListing) {
      const slug = slugify(p.name || '');
      const href = slug
        ? `/professionals/${p.id}/${slug}`
        : `/professionals/${p.id}`;
      entries.push({
        url: `${SITE}${href}`,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
        changeFrequency: 'weekly',
        priority: isAdvocate(p) ? 0.4 : 0.7,
      });
    }
  }

  // Blog posts — published posts only.
  const blogPosts = await fetchJson('/api/blog/posts?limit=5000');
  if (blogPosts && Array.isArray(blogPosts)) {
    for (const post of blogPosts) {
      if (!post.slug) continue;
      entries.push({
        url: `${SITE}/blog/${post.slug}`,
        lastModified: post.updatedAt
          ? new Date(post.updatedAt)
          : post.publishedAt
            ? new Date(post.publishedAt)
            : now,
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    }
  }

  // City landing pages. We surface every city in the admin-managed
  // list — each has a stable /professionals/city/<slug> page.
  const cities = await fetchJson('/api/app-settings/cities');
  if (cities && Array.isArray(cities)) {
    for (const c of cities) {
      const citySlug = slugify(c.name || '');
      if (!citySlug) continue;
      entries.push({
        url: `${SITE}/professionals/city/${citySlug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.55,
      });
    }
  }

  return entries;
}
