// Human-readable sitemap at /sitemap. Linked from the footer so
// visitors (and Google's crawler too) can browse every public-facing
// page in one place. Pulls professionals + blog posts + city landing
// pages live from the backend so the list never goes stale.
//
// The machine-readable XML lives at /sitemap.xml (Next.js convention
// — see app/sitemap.js).

import Link from 'next/link';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';

const PRODUCTION_API_URL = 'https://profirmo.onrender.com';

function resolveApiBaseUrl() {
  if (process.env.API_BACKEND_URL) return process.env.API_BACKEND_URL;
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return PRODUCTION_API_URL;
  }
  return 'http://localhost:5001';
}

async function fetchJson(path) {
  try {
    const res = await fetch(`${resolveApiBaseUrl()}${path}`, {
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

export const metadata = {
  title: 'Sitemap | Pro Firmo',
  description:
    'Browse every public page on Pro Firmo — professionals, firms, blog posts, city directories.',
  alternates: { canonical: '/sitemap' },
};

const STATIC_SECTIONS = [
  {
    title: 'Marketplace',
    links: [
      { href: '/professionals', label: 'Browse professionals' },
      { href: '/firms', label: 'Browse firms' },
      { href: '/search', label: 'Advanced search' },
      { href: '/ecourts', label: 'E-Courts India' },
    ],
  },
  {
    title: 'Get started',
    links: [
      { href: '/signup', label: 'Create an account' },
      { href: '/login', label: 'Sign in' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About us' },
      { href: '/how-it-works', label: 'How it works' },
      { href: '/contact', label: 'Contact us' },
      { href: '/blog', label: 'Blog' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Terms & Conditions' },
      { href: '/privacy', label: 'Privacy Policy' },
    ],
  },
];

export default async function SitemapPage() {
  const [pros, posts, cities] = await Promise.all([
    fetchJson('/api/professionals?limit=2000'),
    fetchJson('/api/blog/posts?limit=2000'),
    fetchJson('/api/app-settings/cities'),
  ]);

  const proLinks = Array.isArray(pros)
    ? pros
        .map((p) => {
          const slug = slugify(p.name || '');
          return {
            href: slug
              ? `/professionals/${p.id}/${slug}`
              : `/professionals/${p.id}`,
            label:
              p.name +
              (p.city ? ` — ${p.city}` : '') +
              (p.professionalType ? ` (${p.professionalType})` : ''),
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label))
    : [];

  const blogLinks = Array.isArray(posts)
    ? posts
        .filter((p) => p && p.slug)
        .map((p) => ({
          href: `/blog/${p.slug}`,
          label: p.title || p.slug,
        }))
        .sort((a, b) => a.label.localeCompare(b.label))
    : [];

  const cityLinks = Array.isArray(cities)
    ? cities
        .map((c) => {
          const s = slugify(c.name || '');
          return s
            ? {
                href: `/professionals/city/${s}`,
                label: `Legal & Tax Experts in ${c.name}`,
              }
            : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.label.localeCompare(b.label))
    : [];

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden">
      <Header />
      <main className="flex-1 bg-slate-50">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
              Sitemap
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Every page on Pro Firmo
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
              A live index of every public page — updated automatically as
              we add professionals, firms, and blog posts. Search-engine
              crawlers should hit{' '}
              <Link href="/sitemap.xml" className="text-amber-700 hover:underline">
                /sitemap.xml
              </Link>{' '}
              instead.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STATIC_SECTIONS.map((sec) => (
              <div key={sec.title}>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {sec.title}
                </h2>
                <ul className="mt-3 space-y-1.5">
                  {sec.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="text-sm text-slate-700 hover:text-amber-700"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {cityLinks.length > 0 && (
            <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                City directories ({cityLinks.length})
              </h2>
              <ul className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {cityLinks.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-slate-700 hover:text-amber-700"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {proLinks.length > 0 && (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Professionals ({proLinks.length})
              </h2>
              <ul className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {proLinks.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-slate-700 hover:text-amber-700"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {blogLinks.length > 0 && (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Blog posts ({blogLinks.length})
              </h2>
              <ul className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {blogLinks.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-slate-700 hover:text-amber-700"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
