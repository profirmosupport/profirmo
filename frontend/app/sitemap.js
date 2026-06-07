// Dynamic sitemap served by Next.js at /sitemap.xml. Google + other
// crawlers consume this; the human-readable variant lives at
// /sitemap (linked in the footer next to Terms & Conditions).
//
// Pulls live data from the backend so newly-added professionals,
// blog posts, and featured cities surface in the next crawl without
// any rebuild.

const PRODUCTION_API_URL = 'https://profirmo.onrender.com';

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
// to crawl the app/ directory.
const STATIC_ROUTES = [
  { path: '/', priority: 1.0, changeFrequency: 'daily' },
  { path: '/professionals', priority: 0.9, changeFrequency: 'daily' },
  { path: '/firms', priority: 0.85, changeFrequency: 'daily' },
  { path: '/search', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/blog', priority: 0.8, changeFrequency: 'daily' },
  { path: '/ecourts', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/pricing', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/how-it-works', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/login', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/signup', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/sitemap', priority: 0.4, changeFrequency: 'weekly' },
];

export default async function sitemap() {
  const SITE = resolveSiteUrl().replace(/\/$/, '');
  const now = new Date();

  const entries = STATIC_ROUTES.map((r) => ({
    url: `${SITE}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // Professionals — paginate up to 5000 to keep the sitemap under
  // Google's 50k-URL / 50 MB ceiling. Larger directories should split
  // into multiple sitemaps (sitemap index); we're well under that for
  // now.
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
        priority: 0.7,
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
