'use client';

// /consult — lead-funnel landing page (mobile-first, bilingual EN/HI).
// Every CTA routes into the same OTP-verified lead flow via the inline
// LandingLeadForm, which redirects to /search?requestVerifed on success.
// Copy is deliberately neutral/informational (no "expert", no solicitation)
// to respect Bar Council of India norms.

import {
  ShieldCheck,
  Lock,
  BadgeCheck,
  MessageSquare,
  Phone,
  ArrowRight,
  Scale,
  Calculator,
  Building2,
  FileText,
  Sparkles,
  IndianRupee,
  Video,
} from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import { useLanguage } from '@/components/LanguageProvider';
import LandingLeadForm from '@/components/leads/LandingLeadForm';

function scrollToForm() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('lead-form');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const input = el.querySelector('input[name="fullName"]');
    if (input) setTimeout(() => input.focus({ preventScroll: true }), 450);
  }
}

function CtaButton({ children, className = '' }) {
  return (
    <button
      type="button"
      onClick={scrollToForm}
      className={`group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:-translate-y-0.5 hover:from-amber-700 hover:to-amber-600 ${className}`}
    >
      <MessageSquare className="h-4 w-4" />
      {children}
      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
    </button>
  );
}

export default function ConsultLandingPage() {
  const { t } = useLanguage();

  const TRUST = [
    { icon: BadgeCheck, key: 'landing.trust.verified' },
    { icon: ShieldCheck, key: 'landing.trust.otp' },
    { icon: Lock, key: 'landing.trust.private' },
    { icon: Sparkles, key: 'landing.trust.noObligation' },
  ];

  const STEPS = [
    { icon: MessageSquare, t: 'landing.how.step1Title', d: 'landing.how.step1Desc' },
    { icon: Phone, t: 'landing.how.step2Title', d: 'landing.how.step2Desc' },
    { icon: BadgeCheck, t: 'landing.how.step3Title', d: 'landing.how.step3Desc' },
  ];

  const AREAS = [
    { icon: Scale, t: 'landing.areas.legal', d: 'landing.areas.legalDesc' },
    { icon: Calculator, t: 'landing.areas.tax', d: 'landing.areas.taxDesc' },
    { icon: Building2, t: 'landing.areas.company', d: 'landing.areas.companyDesc' },
    { icon: FileText, t: 'landing.areas.docs', d: 'landing.areas.docsDesc' },
  ];

  const WHY = [
    { icon: BadgeCheck, t: 'landing.why.verifiedTitle', d: 'landing.why.verifiedDesc' },
    { icon: Lock, t: 'landing.why.privateTitle', d: 'landing.why.privateDesc' },
    { icon: IndianRupee, t: 'landing.why.transparentTitle', d: 'landing.why.transparentDesc' },
    { icon: Video, t: 'landing.why.onlineTitle', d: 'landing.why.onlineDesc' },
  ];

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Header />

      <main className="flex-1">
        {/* HERO */}
        <section className="relative overflow-hidden bg-gradient-to-b from-amber-50 via-white to-teal-50">
          <div
            className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-20 top-32 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:px-8 lg:py-20">
            {/* Copy */}
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-200">
                <Sparkles className="h-3.5 w-3.5" />
                {t('landing.eyebrow')}
              </span>
              <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                {t('landing.hero.title')}
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                {t('landing.hero.subtitle')}
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <CtaButton>{t('landing.hero.cta')}</CtaButton>
                <button
                  type="button"
                  onClick={scrollToForm}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-base font-semibold text-slate-700 transition hover:border-amber-400 hover:text-amber-700"
                >
                  {t('landing.hero.ctaAlt')}
                </button>
              </div>

              <ul className="mt-8 grid grid-cols-2 gap-3 sm:max-w-lg">
                {TRUST.map(({ icon: Icon, key }) => (
                  <li
                    key={key}
                    className="flex items-center gap-2 text-sm font-medium text-slate-600"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-emerald-600" />
                    {t(key)}
                  </li>
                ))}
              </ul>
            </div>

            {/* Form */}
            <div className="lg:pl-4">
              <LandingLeadForm source="Landing page" />
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="bg-white py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t('landing.how.title')}
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {STEPS.map(({ icon: Icon, t: title, d }, i) => (
                <div
                  key={title}
                  className="relative rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center"
                >
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-600 px-2.5 py-0.5 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <Icon className="h-6 w-6" />
                  </span>
                  <p className="mt-4 text-base font-semibold text-slate-900">
                    {t(title)}
                  </p>
                  <p className="mt-1.5 text-sm text-slate-600">{t(d)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AREAS */}
        <section className="bg-slate-50 py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t('landing.areas.title')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-600 sm:text-base">
              {t('landing.areas.subtitle')}
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {AREAS.map(({ icon: Icon, t: title, d }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-teal-300 hover:shadow-lg"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-base font-semibold text-slate-900">
                    {t(title)}
                  </p>
                  <p className="mt-1.5 text-sm text-slate-600">{t(d)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHY */}
        <section className="bg-white py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t('landing.why.title')}
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {WHY.map(({ icon: Icon, t: title, d }) => (
                <div key={title} className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      {t(title)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{t(d)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="bg-gradient-to-br from-slate-900 to-slate-800 py-14 sm:py-16">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {t('landing.final.title')}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300 sm:text-base">
              {t('landing.final.subtitle')}
            </p>
            <div className="mt-7 flex justify-center">
              <CtaButton>{t('landing.final.button')}</CtaButton>
            </div>
          </div>
        </section>

        {/* BCI DISCLAIMER */}
        <section className="bg-slate-50 py-8">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs leading-relaxed text-slate-400">
              {t('landing.disclaimer')}
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
