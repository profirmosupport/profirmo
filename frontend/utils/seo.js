// SEO + AI-discovery helpers.
//
// Builders that turn API records into schema.org JSON-LD. The output is
// consumed by Googlebot, Bingbot, and the live-browsing AI assistants
// (ChatGPT search, Claude, Perplexity, Gemini AI Overviews) to understand
// what each page represents and how to cite it.
//
// All builders return a plain object — wrap it in the `<JsonLd data={...} />`
// component below to render a `<script type="application/ld+json">` tag.

export const SITE_URL =
  (typeof process !== 'undefined' &&
    (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL)) ||
  'https://profirmo.com';

const ORG_REF = { '@id': `${SITE_URL}#organization` };

// Best-effort lookup of a human-readable city label. The professional /
// firm payloads sometimes embed the city object, sometimes only the id.
function cityName(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.name || null;
  return null;
}

// Professional → schema.org Person (the human) + occupational metadata.
// We pick the most specific role we can express. Lawyers map cleanly to
// `Attorney`; tax consultants don't have an exact schema.org type, so they
// stay as `Person` with `jobTitle` carrying the role.
export function buildProfessionalJsonLd(p) {
  if (!p || !p.id) return null;

  const url = `${SITE_URL}/professionals/${p.id}`;
  const isLawyer =
    /lawyer|advocate|legal/i.test(String(p.professionalType || '')) ||
    Boolean(p.lawyer) ||
    Boolean(p.barRegistrationNumber);

  const subCategoryNames = Array.isArray(p.subCategories)
    ? p.subCategories
        .map((c) => (typeof c === 'string' ? c : c && c.name))
        .filter(Boolean)
    : [];

  const ld = {
    '@context': 'https://schema.org',
    '@type': isLawyer ? ['Person', 'Attorney'] : 'Person',
    '@id': `${url}#person`,
    name: p.name || p.fullName || 'Professional',
    url,
    image: p.profilePhoto || undefined,
    jobTitle:
      p.designation ||
      (isLawyer ? 'Advocate' : p.professionalType || 'Consultant'),
    description: p.about || p.bio || undefined,
    knowsLanguage:
      Array.isArray(p.languages) && p.languages.length
        ? p.languages
        : undefined,
    knowsAbout: subCategoryNames.length ? subCategoryNames : undefined,
    worksFor: p.organization
      ? { '@type': 'Organization', name: p.organization }
      : ORG_REF,
    affiliation: ORG_REF,
    identifier: p.barRegistrationNumber || p.licenseNumber || undefined,
  };

  // Optional address — only emit when we have at least one of the parts.
  const city = cityName(p.city);
  if (city || p.chamberAddress) {
    ld.address = {
      '@type': 'PostalAddress',
      addressCountry: 'IN',
      addressLocality: city || undefined,
      streetAddress: p.chamberAddress || undefined,
    };
  }

  // Per BCI Rule 36 / P.N. Vignesh (Madras HC, July 2024), publicly grading
  // and pricing individual advocates is the exact pattern the court flagged.
  // We therefore SKIP aggregateRating + makesOffer for lawyers entirely;
  // CAs, tax consultants, and other non-advocate professions still emit
  // them so legitimate rich results work for those listings.
  if (!isLawyer) {
    const ratingValue = Number(p.rating);
    const reviewCount = Number(p.reviewsCount);
    if (ratingValue > 0 && reviewCount > 0) {
      ld.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: ratingValue.toFixed(1),
        reviewCount,
        bestRating: '5',
        worstRating: '1',
      };
    }

    const fee = Number(p.consultationFee);
    if (fee > 0) {
      ld.makesOffer = {
        '@type': 'Offer',
        name: 'Professional consultation',
        priceCurrency: 'INR',
        price: fee,
        availability: 'https://schema.org/InStock',
        url,
      };
    }
  }

  // Strip undefined values so the rendered JSON stays tidy.
  return stripUndefined(ld);
}

// Firm → schema.org LegalService (covers both law firms and CA/tax firms;
// `LegalService` is the closest specific type, and `ProfessionalService` is
// added as an additional type for tax-side firms).
export function buildFirmJsonLd(f) {
  if (!f || !f.id) return null;

  const url = `${SITE_URL}/firms/${f.id}`;
  const isTax = /tax|gst|chartered|ca/i.test(String(f.firmType || ''));

  const ld = {
    '@context': 'https://schema.org',
    '@type': isTax ? ['LegalService', 'ProfessionalService'] : 'LegalService',
    '@id': `${url}#firm`,
    name: f.firmName || f.name || 'Firm',
    url,
    logo: f.logo || undefined,
    image: f.logo || undefined,
    description: f.about || undefined,
    foundingDate: f.establishedYear ? String(f.establishedYear) : undefined,
    numberOfEmployees: f.professionalCount
      ? { '@type': 'QuantitativeValue', value: f.professionalCount }
      : undefined,
    sameAs: f.website ? [f.website] : undefined,
    parentOrganization: ORG_REF,
  };

  // Address — emit when we have at least the city.
  const city = cityName(f.city);
  if (city) {
    ld.address = {
      '@type': 'PostalAddress',
      addressCountry: 'IN',
      addressLocality: city,
    };
    ld.areaServed = { '@type': 'City', name: city };
  }

  const ratingValue = Number(f.rating);
  const reviewCount = Number(f.reviewsCount);
  if (ratingValue > 0 && reviewCount > 0) {
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: ratingValue.toFixed(1),
      reviewCount,
      bestRating: '5',
      worstRating: '1',
    };
  }

  return stripUndefined(ld);
}

// Strip undefined keys (one level deep — schema.org payloads are shallow).
function stripUndefined(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] =
      v && typeof v === 'object' && !Array.isArray(v) ? stripUndefined(v) : v;
  }
  return out;
}

// Render a JSON-LD script tag. Used inside any client component to attach
// structured data once the API record has loaded.
//
//   <JsonLd data={buildProfessionalJsonLd(professional)} />
//
// Renders nothing when `data` is null/empty, so it's safe to mount before
// the data has arrived.
export function JsonLd({ data, id }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      id={id}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
