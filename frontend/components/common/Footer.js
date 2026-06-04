'use client';

import Link from 'next/link';
import { Twitter, Linkedin, Github, Mail, ArrowRight, MapPin } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

// Top 10 Indian cities surfaced in the footer for SEO landing pages.
const TOP_INDIA_CITIES = [
  'Mumbai',
  'Delhi',
  'Bangalore',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Pune',
  'Ahmedabad',
  'Jaipur',
  'Lucknow',
  'Gautam Budh Nagar',
];

const SOCIALS = [
  { icon: Twitter, label: 'X (Twitter)' },
  { icon: Linkedin, label: 'LinkedIn' },
  { icon: Github, label: 'GitHub' },
  { icon: Mail, label: 'Email' },
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
  const cityNames = TOP_INDIA_CITIES;

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
                onSubmit={(e) => e.preventDefault()}
              >
                <div className="relative flex-1">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    placeholder={t('footer.emailPlaceholder')}
                    aria-label={t('footer.emailPlaceholder')}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-teal-400/60 focus:bg-white/10"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:shadow-glow"
                >
                  {t('footer.subscribe')}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>
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
            {cityNames.map((city) => (
              <Link
                key={`law-${city}`}
                href={`/professionals?city=${encodeURIComponent(city)}`}
                className="text-xs text-slate-400 transition hover:text-teal-300"
              >
                {t('footer.lawyersIn', { city: t(`city.${city}`) })}
              </Link>
            ))}
            {cityNames.map((city) => (
              <Link
                key={`tax-${city}`}
                href={`/professionals?city=${encodeURIComponent(
                  city
                )}&category=${encodeURIComponent('Tax Consultant')}`}
                className="text-xs text-slate-400 transition hover:text-teal-300"
              >
                {t('footer.taxIn', { city: t(`city.${city}`) })}
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
              {SOCIALS.map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  className="glass-dark grid h-9 w-9 place-items-center rounded-xl text-slate-300 transition hover:-translate-y-0.5 hover:text-teal-300 hover:shadow-glow-cyan"
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-5 text-xs">
              <Link
                href="/terms"
                className="text-slate-500 transition hover:text-teal-300"
              >
                {t('footer.linkTerms')}
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
    </footer>
  );
}
