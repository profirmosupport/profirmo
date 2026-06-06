// SEO landing page: /professionals/city/<slug>
//
// Server-rendered so we can emit proper `<title>` / `description` /
// `keywords` per city. Resolves the URL slug to a canonical city row
// via the backend `/api/app-settings/cities/by-slug/:slug` endpoint,
// then defers to a client component that runs the regular
// professionals listing scoped to that city.
//
// Slug shape is the lower-cased city name with non-alphanumeric runs
// collapsed to `-` — e.g. `mumbai`, `new-delhi`. Generated to match
// the helper used in the footer + the backend slugify pass.

import { notFound } from 'next/navigation';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import { API_BASE_URL } from '@/utils/constants';
import CityProfessionalsList from './CityProfessionalsList';

const BRAND = 'Profirmo';

async function fetchCityBySlug(slug) {
  if (!slug) return null;
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/app-settings/cities/by-slug/${encodeURIComponent(slug)}`,
      // Cache for an hour on the server — cities don't change often,
      // and ISR-friendly responses make the page feel instant.
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const body = await res.json();
    return body && (body.data || body);
  } catch {
    return null;
  }
}

// Build SEO-friendly title / description / keywords from the city row.
// Keep keyword count under 12 — long lists hurt rather than help.
function buildMetadata(city, slug) {
  const name = (city && city.name) || prettyFromSlug(slug);
  const stateLabel = city && city.state ? `, ${city.state.name}` : '';
  const title = `Legal & Tax Experts in ${name} | ${BRAND}`;
  const description = `Find verified legal and tax professionals in ${name}${stateLabel}. Browse ${BRAND}'s directory of identity-verified advocates, chartered accountants and consultants serving ${name}.`;
  const keywords = [
    `${name} lawyers`,
    `lawyers in ${name}`,
    `${name} advocates`,
    `${name} legal consultants`,
    `${name} tax consultants`,
    `chartered accountant ${name}`,
    `CA in ${name}`,
    `GST consultant ${name}`,
    `income tax filing ${name}`,
    `${BRAND} ${name}`,
  ];
  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: `/professionals/city/${slug}`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/professionals/city/${slug}`,
      siteName: BRAND,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

function prettyFromSlug(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const city = await fetchCityBySlug(slug);
  return buildMetadata(city, slug);
}

export default async function CityLandingPage({ params }) {
  const { slug } = await params;
  const city = await fetchCityBySlug(slug);
  if (!city) notFound();

  const stateLabel = city.state ? `, ${city.state.name}` : '';

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <section className="border-b border-slate-200 bg-gradient-to-br from-amber-50 via-white to-teal-50">
          <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
              City directory
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Legal &amp; Tax Experts in {city.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
              Browse verified advocates, chartered accountants and tax
              consultants serving {city.name}
              {stateLabel}. Every professional listed has been identity
              verified by {BRAND} — pick one whose practice area matches
              your matter and book directly.
            </p>
          </div>
        </section>

        <CityProfessionalsList
          cityId={city.id}
          cityName={city.name}
          cityState={city.state ? city.state.name : ''}
        />
      </main>
      <Footer />
    </div>
  );
}
