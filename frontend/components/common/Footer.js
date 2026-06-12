'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Linkedin,
  Facebook,
  Instagram,
  Mail,
  ArrowRight,
  MapPin,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { useLocations } from '@/hooks/useLocations';
import NewsletterModal from '@/components/common/NewsletterModal';
import { subscribe as subscribeNewsletter, isValidEmail } from '@/services/newsletterService';

// City-link landing pages we want surfaced in the footer for SEO. We
// pick from the admin-managed cities table at runtime — names that
// don't exist in the DB are skipped so every footer link resolves to a
// real listing. Order matches the curated "metros first" set below;
// remaining slots are filled alphabetically across all India cities.
const FEATURED_CITY_NAMES = [
  'Mumbai',
  'New Delhi',
  'Delhi',
  'Bangalore',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Pune',
  'Ahmedabad',
  'Jaipur',
  'Lucknow',
  'Surat',
  'Chandigarh',
  'Kochi',
  'Indore',
  'Bhopal',
  'Patna',
  'Nagpur',
  'Coimbatore',
  'Vadodara',
  'Visakhapatnam',
  'Thiruvananthapuram',
  'Gurugram',
  'Noida',
  'Faridabad',
  'Ghaziabad',
  'Dehradun',
  'Guwahati',
  'Ranchi',
  'Raipur',
];

// Footer social links. Each external profile carries `rel="nofollow
// noopener noreferrer"` so we (a) don't pass link equity to the
// third-party page and (b) open them in a tab that can't reach back
// into our session via `window.opener`.
const SOCIALS = [
  {
    icon: Linkedin,
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/pro-firmo/',
  },
  {
    icon: Facebook,
    label: 'Facebook',
    href: 'https://www.facebook.com/fbprofirmo',
  },
  {
    icon: Instagram,
    label: 'Instagram',
    href: 'https://www.instagram.com/profirmoinsta/',
  },
  {
    icon: Mail,
    label: 'Email',
    href: 'mailto:support@profirmo.com',
  },
];

const COLUMNS = [
  {
    headingKey: 'footer.colCompany',
    links: [
      { key: 'footer.linkAbout', href: '/about' },
      { key: 'footer.linkHowItWorks', href: '/how-it-works' },
      { key: 'footer.linkPricing', href: '/pricing' },
      { key: 'footer.linkContact', href: '/contact' },
    ],
  },
  {
    headingKey: 'footer.colExplore',
    links: [
      { key: 'footer.linkProfessionals', href: '/professionals' },
      { key: 'footer.linkFirms', href: '/firms' },
      { key: 'footer.linkSearch', href: '/search' },
      { key: 'footer.linkUnifiedCases', href: '/unified-cases' },
    ],
  },
  {
    headingKey: 'footer.colProfessionals',
    links: [
      { key: 'footer.linkJoinPro', href: '/auth/register-professional' },
      { key: 'footer.linkLogin', href: '/auth/login' },
    ],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();
  const { t } = useLanguage();
  const { flatCities } = useLocations();

  // Newsletter signup state — drives the inline status pill + the
  // post-submit "tell us more" modal.
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState('idle'); // idle | loading | success | error
  const [newsletterError, setNewsletterError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [savedEmail, setSavedEmail] = useState('');

  async function handleNewsletterSubmit(e) {
    if (e) e.preventDefault();
    if (newsletterStatus === 'loading') return;
    const email = newsletterEmail.trim();
    setNewsletterError('');
    if (!isValidEmail(email)) {
      setNewsletterStatus('error');
      setNewsletterError('Please enter a valid email address.');
      return;
    }
    setNewsletterStatus('loading');
    try {
      await subscribeNewsletter(email);
      setSavedEmail(email);
      setNewsletterEmail('');
      setNewsletterStatus('success');
      setModalOpen(true);
    } catch (err) {
      setNewsletterStatus('error');
      setNewsletterError(err.message || 'Subscription failed. Try again.');
    }
  }

  // Resolve each curated city NAME against the admin-managed cities
  // table, preferring exact case-insensitive matches. The result is an
  // ordered list of { id, name } so every footer link points at a row
  // that actually exists (and so query-string `?city=<id>` resolves
  // cleanly on the listing page). Unknown names are dropped silently.
  const cityRows = useMemo(() => {
    if (!Array.isArray(flatCities) || flatCities.length === 0) return [];
    const byLowerName = new Map();
    for (const c of flatCities) {
      const key = String(c.name || '').trim().toLowerCase();
      if (!key) continue;
      // First seen wins — keeps the first DB row alphabetic order would
      // surface (we don't want New Delhi mapping to Old Delhi).
      if (!byLowerName.has(key)) byLowerName.set(key, c);
    }
    // Public landing-page slug — matches the backend slugify() helper:
    // lowercased name, non-alphanumeric runs collapsed to `-`.
    const publicSlug = (s) =>
      String(s || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const seen = new Set();
    const out = [];
    for (const name of FEATURED_CITY_NAMES) {
      const hit = byLowerName.get(String(name).trim().toLowerCase());
      if (!hit || seen.has(hit.id)) continue;
      seen.add(hit.id);
      out.push({ id: hit.id, name: hit.name, slug: publicSlug(hit.name) });
    }
    return out;
  }, [flatCities]);

  return (
    <footer className="relative overflow-hidden bg-slate-950 text-slate-400">
      <div
        className="pointer-events-none absolute inset-0 bg-grid-dark opacity-60"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-amber-600/15 blur-3xl animate-pulse-glow"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 right-1/4 h-72 w-72 rounded-full bg-teal-500/12 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Top: brand + newsletter + link columns */}
        <div className="grid gap-12 lg:grid-cols-[1.7fr_1fr_1fr_1fr]">
          <div>
            <Link
              href="/"
              className="flex items-center gap-2.5"
              aria-label="Pro Firmo home"
            >
              <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-teal-600 text-white shadow-glow-sm">
                <span className="text-[13px] font-extrabold tracking-tight">
                  PF
                </span>
              </span>
              <span className="text-lg font-bold tracking-tight text-white">
                Pro <span className="text-gradient-light">Firmo</span>
              </span>
            </Link>

            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
              {t('footer.about')}
            </p>

            <div className="mt-6">
              <p className="text-sm font-semibold text-white">
                {t('footer.newsletterTitle')}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {t('footer.newsletterText')}
              </p>
              <form
                className="mt-3 flex max-w-sm items-center gap-2"
                onSubmit={handleNewsletterSubmit}
              >
                <div className="relative flex-1">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={newsletterEmail}
                    onChange={(e) => {
                      setNewsletterEmail(e.target.value);
                      if (newsletterStatus !== 'idle') {
                        setNewsletterStatus('idle');
                        setNewsletterError('');
                      }
                    }}
                    placeholder={t('footer.emailPlaceholder')}
                    aria-label={t('footer.emailPlaceholder')}
                    autoComplete="email"
                    inputMode="email"
                    required
                    disabled={newsletterStatus === 'loading'}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-teal-400/60 focus:bg-white/10 disabled:opacity-60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={newsletterStatus === 'loading'}
                  className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:shadow-glow disabled:opacity-60"
                >
                  {newsletterStatus === 'loading' ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      …
                    </>
                  ) : (
                    <>
                      {t('footer.subscribe')}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </form>
              {newsletterStatus === 'success' && (
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Subscribed. Open the popup for personalisation options.
                </p>
              )}
              {newsletterStatus === 'error' && newsletterError && (
                <p className="mt-2 text-xs text-rose-400">{newsletterError}</p>
              )}
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.headingKey}>
              <h3 className="text-sm font-semibold text-white">
                {t(col.headingKey)}
              </h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 transition hover:text-teal-300"
                    >
                      {t(link.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* City links */}
        <div className="mt-14 border-t border-white/10 pt-10">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-teal-400" />
            <h3 className="text-sm font-semibold text-white">
              {t('footer.cityTitle')}
            </h3>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            {t('footer.cityIntro')}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-3">
            {cityRows.map((city) => (
              <Link
                key={`city-${city.id}`}
                href={`/professionals/city/${city.slug}`}
                className="text-xs text-slate-400 transition hover:text-teal-300"
              >
                Legal &amp; Tax Experts in {city.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-white/10 pt-8">
          <p className="text-xs leading-relaxed text-slate-500">
            {t('footer.disclaimer')}
          </p>
          <div className="mt-5 flex flex-col items-center justify-between gap-5 sm:flex-row">
            <p className="text-xs text-slate-500">
              © {year} Pro Firmo. {t('footer.rights')}
            </p>

            <div className="flex items-center gap-2">
              {SOCIALS.map(({ icon: Icon, label, href }) => {
                // mailto: links open in the same tab; external https
                // social profiles open in a new tab and never pass
                // link equity (rel="nofollow").
                const isMail = href && href.startsWith('mailto:');
                return (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    target={isMail ? undefined : '_blank'}
                    rel={isMail ? undefined : 'nofollow noopener noreferrer'}
                    className="glass-dark grid h-9 w-9 place-items-center rounded-xl text-slate-300 transition hover:-translate-y-0.5 hover:text-teal-300 hover:shadow-glow-cyan"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>

            <div className="flex items-center gap-5 text-xs">
              <Link
                href="/terms"
                className="text-slate-500 transition hover:text-teal-300"
              >
                {t('footer.linkTerms')}
              </Link>
              <Link
                href="/sitemap"
                className="text-slate-500 transition hover:text-teal-300"
              >
                {t('footer.linkSitemap')}
              </Link>
              <Link
                href="/privacy"
                className="text-slate-500 transition hover:text-teal-300"
              >
                {t('footer.linkPrivacy')}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Newsletter "tell us more" popup — opens on a successful
          /api/newsletter/subscribe response so the visitor can
          optionally enrich their profile. */}
      <NewsletterModal
        open={modalOpen}
        email={savedEmail}
        onClose={() => setModalOpen(false)}
      />
    </footer>
  );
}
