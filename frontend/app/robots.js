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

export default function robots() {
  const site = resolveSiteUrl().replace(/\/$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
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
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
