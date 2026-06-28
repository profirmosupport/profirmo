// /services/[slug] — server-rendered landing for one consultation service.
// Content comes from frontend/data/serviceLandings.js (single source of truth
// reused by the Knowledge dropdown + the index grid). SSG via
// generateStaticParams so every URL is pre-built at deploy time.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CheckCircle2,
  Sparkles,
  Users,
  ArrowRight,
  MapPin,
  HelpCircle,
} from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import LeadGenFloater from '@/components/common/LeadGenFloater';
import {
  SERVICE_LANDINGS,
  TOP_CITIES,
  ICONS,
} from '@/data/serviceLandings';
import { PILLAR_PAGES } from '@/data/pillarPages';

const SITE_URL = 'https://profirmo.com';

// Pre-build every slug at deploy time (15 pages, all static).
export function generateStaticParams() {
  return SERVICE_LANDINGS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const s = SERVICE_LANDINGS.find((x) => x.slug === slug);
  if (!s) return { title: 'Service · Pro Firmo' };
  const url = `${SITE_URL}/services/${s.slug}`;
  // hreflang — for pillars that have a Hindi translation, point Google at
  // the parallel /hi/services/<slug> page so Indian Hindi searchers see the
  // Hindi version in SERPs.
  const HI_PILLARS = new Set(['gst-consultation']);
  const hasHindi = HI_PILLARS.has(s.slug);
  const languages = hasHindi
    ? {
        'en-IN': `/services/${s.slug}`,
        'hi-IN': `/hi/services/${s.slug}`,
        'x-default': `/services/${s.slug}`,
      }
    : undefined;
  return {
    title: `${s.title} · Pro Firmo`,
    description: s.subtitle,
    keywords: s.keywords,
    alternates: {
      canonical: `/services/${s.slug}`,
      ...(languages ? { languages } : {}),
    },
    openGraph: {
      title: `${s.title} · Pro Firmo`,
      description: s.subtitle,
      url,
      siteName: 'Pro Firmo',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${s.title} · Pro Firmo`,
      description: s.subtitle,
    },
  };
}

const ACCENT = {
  amber: { tile: 'bg-amber-100 text-amber-700', strip: 'bg-amber-500', ring: 'ring-amber-100' },
  teal: { tile: 'bg-teal-100 text-teal-700', strip: 'bg-teal-500', ring: 'ring-teal-100' },
  indigo: { tile: 'bg-indigo-100 text-indigo-700', strip: 'bg-indigo-500', ring: 'ring-indigo-100' },
  rose: { tile: 'bg-rose-100 text-rose-700', strip: 'bg-rose-500', ring: 'ring-rose-100' },
};

export default async function ServiceLandingPage({ params }) {
  const { slug } = await params;
  const s = SERVICE_LANDINGS.find((x) => x.slug === slug);
  if (!s) return notFound();

  const Icon = ICONS[s.icon];
  const accent = ACCENT[s.accent] || ACCENT.amber;
  // Advocate-tier categories run in "information & access" mode per BCI Rule
  // 36 / P.N. Vignesh — flagged via the accessOnly bit on the data entry.
  const accessOnly = !!s.accessOnly;
  // Category pillars get long-form authority sections rendered below the FAQ.
  const pillar = s.pillarSlug ? PILLAR_PAGES[s.pillarSlug] : null;

  const pageUrl = `${SITE_URL}/services/${s.slug}`;

  // FAQ + Service + Breadcrumb JSON-LD — Google / AI search love this
  // for service pages. The Service node anchors to the site
  // Organization defined in the root layout.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: s.faq.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${pageUrl}#service`,
    name: s.title,
    description: s.subtitle,
    serviceType: s.category || 'Legal & tax advisory',
    provider: { '@id': `${SITE_URL}#organization` },
    areaServed: { '@type': 'Country', name: 'India' },
    url: pageUrl,
    audience: { '@type': 'Audience', audienceType: 'Individuals and businesses in India' },
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Services', item: `${SITE_URL}/services` },
      { '@type': 'ListItem', position: 3, name: s.title, item: pageUrl },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
          <div className="pointer-events-none absolute -right-32 top-0 h-72 w-72 rounded-full bg-amber-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -left-32 bottom-0 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
            <Link
              href="/services"
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-200 hover:underline"
            >
              ← All services
            </Link>
            <div className="mt-4 flex items-center gap-4">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accent.tile}`}
              >
                {Icon ? <Icon size={22} /> : null}
              </span>
              <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
                {s.title}
              </h1>
            </div>
            <p className="mt-4 max-w-3xl text-base text-slate-300 sm:text-lg">
              {s.subtitle}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={`/search?q=${encodeURIComponent(s.title)}`}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-500/30 transition hover:bg-amber-400"
              >
                <Sparkles size={16} />
                {accessOnly ? 'Describe your matter to AI' : 'Discuss with AI first'}
              </Link>
              {accessOnly ? (
                <Link
                  href="/consult"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
                >
                  <Users size={16} />
                  Request access to a verified professional
                </Link>
              ) : (
                <Link
                  href="/professionals"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
                >
                  <Users size={16} />
                  Browse professionals
                </Link>
              )}
            </div>
            {accessOnly && (
              <p className="mt-3 max-w-3xl text-[11px] leading-relaxed text-amber-200/80">
                This page is informational. Pro Firmo does not advertise,
                recommend or endorse any specific advocate. We facilitate
                access to verified, independent professionals; engagement,
                fees and outcomes are between you and the professional you
                choose.
              </p>
            )}
          </div>
        </section>

        {/* Two-column body — problem on the left, "how we help" on the right */}
        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                The common problem
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-700">
                {s.problem}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                {accessOnly ? 'How Pro Firmo helps you understand and access' : 'How Pro Firmo helps'}
              </h2>
              <ul className="mt-3 space-y-3">
                {s.howWeHelp.map((h, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2
                      size={16}
                      className="mt-0.5 shrink-0 text-emerald-600"
                    />
                    <span className="text-sm leading-relaxed text-slate-700">
                      {h}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Documents + Process */}
        <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Documents you&apos;ll need
              </h2>
              <ul className="mt-3 space-y-2">
                {s.documents.map((doc, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm text-slate-700"
                  >
                    <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Expected consultation process
              </h2>
              <ol className="mt-3 space-y-3">
                {s.process.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${accent.strip}`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-slate-700">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Dual CTA strip */}
        <section className="bg-slate-100/60 py-10">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Link
                href={`/search?q=${encodeURIComponent(s.title)}`}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 transition hover:border-amber-400 hover:bg-amber-100"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
                    Step 1
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    Discuss your case with AI
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Free, instant, no signup needed.
                  </p>
                </div>
                <Sparkles
                  size={20}
                  className="text-amber-600 transition group-hover:scale-110"
                />
              </Link>
              <Link
                href={accessOnly ? '/consult' : '/professionals'}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-5 transition hover:border-teal-400 hover:bg-teal-100"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
                    Step 2
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {accessOnly
                      ? 'Request access to a verified professional'
                      : 'Browse verified professionals'}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {accessOnly
                      ? 'We connect you with an independent, verified professional. You choose.'
                      : 'Filter by city, rating, experience.'}
                  </p>
                </div>
                <Users
                  size={20}
                  className="text-teal-600 transition group-hover:scale-110"
                />
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center gap-2">
            <HelpCircle size={18} className="text-amber-600" />
            <h2 className="text-base font-semibold uppercase tracking-widest text-slate-700">
              FAQs
            </h2>
          </div>
          <dl className="space-y-4">
            {s.faq.map(([q, a]) => (
              <div
                key={q}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <dt className="text-sm font-semibold text-slate-900">
                  {q}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-slate-700">
                  {a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Pillar deep-dive — only present on category pillar pages. */}
        {pillar ? (
          <section className="mx-auto max-w-3xl px-4 pb-14 sm:px-6 lg:px-8">
            <div className="mb-6 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-800">
                Deep dive
              </span>
              <h2 className="text-base font-semibold uppercase tracking-widest text-slate-700">
                The complete guide
              </h2>
            </div>
            {pillar.intro ? (
              <p className="mb-8 text-sm leading-relaxed text-slate-700">
                {pillar.intro}
              </p>
            ) : null}
            <div className="space-y-8">
              {pillar.sections.map((sec) => (
                <article key={sec.heading}>
                  <h3 className="text-base font-semibold text-slate-900">
                    {sec.heading}
                  </h3>
                  <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">
                    {sec.body.map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            {Array.isArray(pillar.related) && pillar.related.length > 0 ? (
              <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Related
                </p>
                <ul className="mt-3 grid grid-cols-1 gap-2 text-sm text-amber-700 sm:grid-cols-3">
                  {pillar.related.map((r) => (
                    <li key={r.href}>
                      <Link
                        href={r.href}
                        className="hover:underline underline-offset-2"
                      >
                        {r.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* City-wise internal links */}
        <section className="bg-slate-100/60 py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="mb-4 flex items-center gap-2">
              <MapPin size={16} className="text-slate-600" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-700">
                {accessOnly
                  ? 'Access verified professionals by city'
                  : 'Find professionals near you'}
              </h2>
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {TOP_CITIES.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/professionals/city/${c.slug}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-300 hover:text-amber-700"
                  >
                    {c.name}
                    <ArrowRight size={14} className="text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Don&apos;t see your city? Use{' '}
              <Link
                href="/professionals"
                className="font-semibold text-amber-700 hover:underline"
              >
                the full search
              </Link>{' '}
              — we cover every metro and most tier-2 cities.
            </p>
          </div>
        </section>
      </main>

      <Footer />
      <LeadGenFloater source={`service-${s.slug}`} />
    </div>
  );
}
