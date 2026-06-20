// Human-readable sitemap at /sitemap. Linked from the footer so visitors
// (and Google's crawler) can browse every public-facing page in one place.
// Pulls live blog posts + city directories from the backend so the list
// never goes stale; service landings + tools + supply pages + pillar
// hubs come from a static manifest below.
//
// The machine-readable XML lives at /sitemap.xml (Next.js convention —
// see app/sitemap.js).

import Link from 'next/link';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import { SERVICE_LANDINGS } from '@/data/serviceLandings';

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

// Advocate detection — mirrors the noindex / sitemap filter logic.
function isAdvocate(p) {
  const t = String((p && p.professionalType) || '').toLowerCase();
  if (t.includes('lawyer') || t.includes('advocate') || t.includes('legal')) {
    return true;
  }
  return !!(p && (p.barRegistrationNumber || (p.lawyer && p.lawyer.barRegistrationNumber)));
}

export const metadata = {
  title: 'Sitemap | Pro Firmo',
  description:
    'Browse every public page on Pro Firmo — services, pillar guides, free tools, city directories, professionals, blog and resources.',
  alternates: { canonical: '/sitemap' },
};

// Pillar slugs — surfaced separately at the top of the Services section to
// emphasise them as the head-term authority pages.
const PILLAR_SLUGS = new Set([
  'gst-consultation',
  'income-tax-itr',
  'company-registration-and-roc',
  'startup-compliance',
]);

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
      { href: '/resources', label: 'Resources (topic clusters)' },
    ],
  },
  {
    title: 'For professionals',
    links: [
      { href: '/for-professionals', label: 'Grow your practice on Pro Firmo' },
      { href: '/join-team', label: 'Referral Partner programme' },
      { href: '/join-team/guide', label: 'Onboarding guide' },
      { href: '/join-team/terms', label: 'Partner terms' },
      { href: '/join-team/privacy', label: 'Partner privacy' },
    ],
  },
  {
    title: 'Free tools',
    links: [
      { href: '/tools/gst-calculator', label: 'GST calculator (₹ + CGST/SGST/IGST)' },
    ],
  },
  {
    title: 'Knowledge — हिन्दी (Hindi)',
    links: [
      { href: '/hi/services/gst-consultation', label: 'GST परामर्श: 2026 की संपूर्ण मार्गदर्शिका' },
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

  // Knowledge / Services links — pull live from the data file so adding a
  // new service landing automatically surfaces it here.
  const pillarLinks = SERVICE_LANDINGS.filter((s) => PILLAR_SLUGS.has(s.slug)).map((s) => ({
    href: `/services/${s.slug}`,
    label: `${s.title} — pillar`,
  }));
  const otherServiceLinks = SERVICE_LANDINGS.filter((s) => !PILLAR_SLUGS.has(s.slug)).map((s) => ({
    href: `/services/${s.slug}`,
    label: s.accessOnly ? `${s.title} — info` : s.title,
  }));

  // Split professionals into advocates vs others so the human-readable
  // sitemap surfaces both groups but signals which is which. Both groups
  // are listed; individual advocate profile pages remain noindex.
  function asProLink(p) {
    const slug = slugify(p.name || '');
    return {
      href: slug
        ? `/professionals/${p.id}/${slug}`
        : `/professionals/${p.id}`,
      label:
        (p.name || '') +
        (p.city ? ` — ${p.city}` : '') +
        (p.professionalType ? ` (${p.professionalType})` : ''),
    };
  }
  const advocateLinks = Array.isArray(pros)
    ? pros
        .filter(isAdvocate)
        .map(asProLink)
        .sort((a, b) => a.label.localeCompare(b.label))
    : [];
  const proLinks = Array.isArray(pros)
    ? pros
        .filter((p) => !isAdvocate(p))
        .map(asProLink)
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
              we add services, professionals, firms, and blog posts.
              Search-engine crawlers should hit{' '}
              <Link href="/sitemap.xml" className="text-amber-700 hover:underline">
                /sitemap.xml
              </Link>{' '}
              instead.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-10">
          {/* Top static groups */}
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

          {/* Knowledge — pillar pages + other service landings */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Knowledge — Services & guides ({SERVICE_LANDINGS.length + 1})
              </h2>
              <Link
                href="/services"
                className="text-xs font-semibold text-amber-700 hover:underline"
              >
                View as grid →
              </Link>
            </div>

            {pillarLinks.length > 0 && (
              <>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-teal-700">
                  Pillar guides
                </p>
                <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {pillarLinks.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="font-medium text-slate-800 hover:text-amber-700"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {otherServiceLinks.length > 0 && (
              <>
                <p className="mt-6 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  Service landings
                </p>
                <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {otherServiceLinks.map((l) => (
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
              </>
            )}
          </div>

          {cityLinks.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
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
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Professionals ({proLinks.length})
              </h2>
              <p className="mt-1 text-[11px] text-slate-400">
                Verified tax, GST, CA, CS, and documentation professionals.
              </p>
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

          {advocateLinks.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Legal professionals ({advocateLinks.length})
              </h2>
              <p className="mt-1 text-[11px] text-slate-400">
                Verified advocates and legal consultants. Profiles are
                informational; Pro Firmo does not advertise, recommend or
                endorse any specific advocate (BCI Rule 36). Engagement is
                between you and the professional.
              </p>
              <ul className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {advocateLinks.map((l) => (
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
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
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
