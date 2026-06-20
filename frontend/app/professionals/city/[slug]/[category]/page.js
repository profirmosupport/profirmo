// /professionals/city/[slug]/[category] — programmatic landing per the
// strategy §7 supply-gate. Whitelisted LOW-RISK categories only; advocate-tier
// categories never get a city × category page (strategy §1).
//
// Server-rendered. On every request, fetches:
//   - the canonical city via /api/app-settings/cities/by-slug/:slug
//   - a count of APPROVED professionals matching the category hint in that
//     city; if the count is below MIN_SUPPLY, returns notFound() so the URL
//     does not exist publicly.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import LeadGenFloater from '@/components/common/LeadGenFloater';
import { API_BASE_URL } from '@/utils/constants';

const PRODUCTION_API_URL = 'https://profirmo.onrender.com';
const BRAND = 'Profirmo';

// Strategy §7.1 — only generate when we have at least N verified pros for the
// city × category. Below this threshold, the page 404s so Google never sees
// an empty page.
const MIN_SUPPLY = 3;

// Whitelist of categories that may have a programmatic city page. Advocate-
// tier categories are excluded by design per strategy §1 (BCI Rule 36).
const CATEGORY_MAP = {
  'gst-consultation': {
    label: 'GST Consultation',
    professionalType: 'Tax Consultant',
    keywords: 'GST consultant, GST registration, GST notice, GST return filing',
    pillarHref: '/services/gst-consultation',
  },
  'income-tax-itr': {
    label: 'Income Tax & ITR Filing',
    professionalType: 'Tax Consultant',
    keywords: 'CA for ITR filing, income tax consultant, tax notice reply',
    pillarHref: '/services/income-tax-itr',
  },
  'company-registration-and-roc': {
    label: 'Company Registration & ROC',
    professionalType: 'Company Secretary',
    keywords: 'company registration, Pvt Ltd, LLP, ROC compliance, MGT-7',
    pillarHref: '/services/company-registration-and-roc',
  },
  'startup-compliance': {
    label: 'Startup Compliance',
    professionalType: 'Company Secretary',
    keywords: 'startup compliance, DPIIT, ESOP, FEMA FC-GPR, founders agreement',
    pillarHref: '/services/startup-compliance',
  },
  'trademark': {
    label: 'Trademark Filing',
    professionalType: 'IP Attorney',
    keywords: 'trademark filing, TM-A, trademark objection response, brand protection',
    pillarHref: '/services/trademark-consultation',
  },
  'rental-agreement': {
    label: 'Rental Agreement Drafting',
    professionalType: 'Documentation Expert',
    keywords: 'rental agreement, leave and license, e-stamp, registration',
    pillarHref: '/services/rental-agreement-drafting',
  },
  'business-contract-review': {
    label: 'Business Contract Review',
    professionalType: 'Documentation Expert',
    keywords: 'contract review, NDA, MSA, vendor agreement',
    pillarHref: '/services/business-contract-review',
  },
};

const SITE_URL = 'https://profirmo.com';

function apiBase() {
  // Prefer SSR-time API URL (Render production); fall back to client base.
  if (process.env.API_BACKEND_URL) return process.env.API_BACKEND_URL;
  if (typeof API_BASE_URL === 'string' && API_BASE_URL.includes('localhost')) {
    return API_BASE_URL;
  }
  return PRODUCTION_API_URL;
}

async function fetchCity(slug) {
  try {
    const res = await fetch(
      `${apiBase()}/api/app-settings/cities/by-slug/${encodeURIComponent(slug)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const body = await res.json();
    return body && body.data ? body.data : body;
  } catch {
    return null;
  }
}

async function countSupply(cityId, professionalType) {
  try {
    const url = `${apiBase()}/api/professionals?city=${encodeURIComponent(
      cityId
    )}&professionalType=${encodeURIComponent(
      professionalType
    )}&status=APPROVED&page=1&limit=1`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return 0;
    const body = await res.json();
    if (body && body.meta && typeof body.meta.total === 'number') {
      return body.meta.total;
    }
    if (Array.isArray(body && body.data)) return body.data.length;
    return 0;
  } catch {
    return 0;
  }
}

export async function generateMetadata({ params }) {
  const { slug, category } = await params;
  const cat = CATEGORY_MAP[category];
  if (!cat) return { title: 'Not found' };
  const city = await fetchCity(slug);
  if (!city) return { title: 'Not found' };
  const title = `${cat.label} in ${city.name} · Pro Firmo`;
  const desc = `Book a consultation with a verified ${cat.professionalType} in ${city.name}${
    city.state ? `, ${city.state.name}` : ''
  }. ${cat.keywords}. Identity-verified by ${BRAND}.`;
  return {
    title,
    description: desc,
    keywords: `${cat.keywords}, ${city.name}`,
    alternates: { canonical: `/professionals/city/${slug}/${category}` },
    openGraph: { title, description: desc, type: 'website' },
  };
}

export default async function CityCategoryPage({ params }) {
  const { slug, category } = await params;
  const cat = CATEGORY_MAP[category];
  if (!cat) notFound();
  const city = await fetchCity(slug);
  if (!city) notFound();
  // Strategy §7.1 — supply gate.
  const supply = await countSupply(city.id, cat.professionalType);
  if (supply < MIN_SUPPLY) notFound();

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden">
      <Header />
      <main className="flex-1 bg-slate-50">
        <section className="border-b border-slate-200 bg-gradient-to-br from-amber-50 via-white to-teal-50">
          <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
              {city.name}
              {city.state ? ` · ${city.state.name}` : ''}
            </p>
            <h1 className="mt-2 break-words text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {cat.label} in {city.name}
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-700 sm:text-base">
              Connect with a verified {cat.professionalType.toLowerCase()} based
              in {city.name} for help with {cat.keywords}. Every professional
              listed is identity-verified by Pro Firmo.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
              <Link
                href={`/professionals?city=${encodeURIComponent(
                  city.id
                )}&professionalType=${encodeURIComponent(cat.professionalType)}`}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 font-semibold text-white shadow hover:bg-amber-700"
              >
                Browse {supply}+ verified professionals
                <ArrowRight size={14} />
              </Link>
              <Link
                href={cat.pillarHref}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:border-amber-300 hover:text-amber-700"
              >
                Read the full {cat.label} guide
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              About {cat.label} in {city.name}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              {cat.label} engagements in {city.name} typically combine
              registration, periodic returns, and incident-driven work
              (notices, audits, refunds). Local procedural quirks — the
              jurisdictional officer's pattern, the regional commissioner's
              circulars, and city-level tax compliance norms — all influence
              turnaround and cost.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              Pro Firmo connects you with verified professionals whose
              practice covers your specific city and category. We do not
              advertise, recommend, or endorse individuals; we facilitate
              access. Engagement, fees, and outcomes are between you and the
              professional you select.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-14 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-center gap-2">
            <MapPin size={14} className="text-slate-600" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-700">
              Related cities for {cat.label}
            </h2>
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {['mumbai', 'new-delhi', 'bangalore', 'hyderabad', 'chennai', 'pune', 'kolkata', 'ahmedabad', 'gurgaon', 'noida']
              .filter((c) => c !== slug)
              .slice(0, 9)
              .map((c) => (
                <li key={c}>
                  <Link
                    href={`/professionals/city/${c}/${category}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium capitalize text-slate-700 transition hover:border-amber-300 hover:text-amber-700"
                  >
                    {c.replace('-', ' ')}
                    <ArrowRight size={12} className="text-slate-300" />
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      </main>
      <Footer />
      <LeadGenFloater source={`city-category-${slug}-${category}`} />
    </div>
  );
}
