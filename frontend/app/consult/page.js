'use client';

// /consult — artistic, bilingual (EN/HI) lead-funnel landing page.
// Every CTA + clickable category/area opens the ConsultLeadModal, which runs
// the OTP-verified lead flow and redirects to /search?requestVerifed. Copy is
// neutral/informational (no "expert", no solicitation) per Bar Council of
// India norms; the disclaimer states this explicitly.

import { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  BadgeCheck,
  MessageSquare,
  ArrowRight,
  Scale,
  Calculator,
  Building2,
  FileText,
  Sparkles,
  IndianRupee,
  Video,
  Heart,
  Landmark,
  Receipt,
  ShoppingBag,
  Gavel,
  Briefcase,
  ShieldAlert,
  ScrollText,
  KeyRound,
  FileWarning,
  ChevronDown,
} from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import { useLanguage } from '@/components/LanguageProvider';
import LandingLeadForm from '@/components/leads/LandingLeadForm';
import ConsultLeadModal from '@/components/leads/ConsultLeadModal';

// ─── Imagery ─────────────────────────────────────────────────────────────
// All page images live here so they're trivial to swap. These are
// illustrative PLACEHOLDER stock photos (picsum) — NOT real Profirmo
// clients. Replace each URL with your own licensed photos of real people
// (e.g. upload to the profirmomain S3 bucket, already whitelisted, and paste
// the URLs here). Recommended: ~900×700 for story frames, ~1600×900 for
// backgrounds. We intentionally use no names/quotes/outcomes with these
// images, so nothing reads as a fabricated testimonial.
const IMAGES = {
  heroBg: 'https://picsum.photos/seed/pf-hero-bg/1600/1000',
  ctaBg: 'https://picsum.photos/seed/pf-cta-bg/1600/900',
  story: {
    worried: 'https://picsum.photos/seed/pf-story-worried/900/700',
    share: 'https://picsum.photos/seed/pf-story-share/900/700',
    connect: 'https://picsum.photos/seed/pf-story-connect/900/700',
    relief: 'https://picsum.photos/seed/pf-story-relief/900/700',
  },
};

export default function ConsultLandingPage() {
  const { t } = useLanguage();
  const [modal, setModal] = useState({ open: false, prefill: '' });
  const openModal = (prefill = '') => setModal({ open: true, prefill });
  const closeModal = () => setModal((m) => ({ ...m, open: false }));

  const TRUST = [
    { icon: BadgeCheck, key: 'landing.trust.verified' },
    { icon: ShieldCheck, key: 'landing.trust.otp' },
    { icon: Lock, key: 'landing.trust.private' },
    { icon: Sparkles, key: 'landing.trust.noObligation' },
  ];

  const CATEGORIES = [
    { icon: Heart, key: 'landing.cats.divorce' },
    { icon: Landmark, key: 'landing.cats.property' },
    { icon: Receipt, key: 'landing.cats.cheque' },
    { icon: ShoppingBag, key: 'landing.cats.consumer' },
    { icon: Gavel, key: 'landing.cats.criminal' },
    { icon: Briefcase, key: 'landing.cats.employment' },
    { icon: ShieldAlert, key: 'landing.cats.cyber' },
    { icon: ScrollText, key: 'landing.cats.will' },
    { icon: Calculator, key: 'landing.cats.tax' },
    { icon: Building2, key: 'landing.cats.company' },
    { icon: KeyRound, key: 'landing.cats.rent' },
    { icon: FileWarning, key: 'landing.cats.notice' },
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

  const FAQS = [
    { q: 'landing.faq.q1', a: 'landing.faq.a1' },
    { q: 'landing.faq.q2', a: 'landing.faq.a2' },
    { q: 'landing.faq.q3', a: 'landing.faq.a3' },
    { q: 'landing.faq.q4', a: 'landing.faq.a4' },
    { q: 'landing.faq.q5', a: 'landing.faq.a5' },
  ];

  const STORY = [
    { img: IMAGES.story.worried, t: 'landing.story.s1Title', d: 'landing.story.s1Desc' },
    { img: IMAGES.story.share, t: 'landing.story.s2Title', d: 'landing.story.s2Desc' },
    { img: IMAGES.story.connect, t: 'landing.story.s3Title', d: 'landing.story.s3Desc' },
    { img: IMAGES.story.relief, t: 'landing.story.s4Title', d: 'landing.story.s4Desc' },
  ];

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Header />

      <main className="flex-1">
        {/* ===== HERO ===== */}
        <section className="relative overflow-hidden bg-gradient-to-b from-amber-50 via-white to-teal-50">
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.07]"
            style={{ backgroundImage: `url(${IMAGES.heroBg})` }}
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" aria-hidden="true" />
          <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-amber-400/25 blur-3xl animate-pulse-glow" aria-hidden="true" />
          <div className="pointer-events-none absolute -right-16 top-32 h-72 w-72 rounded-full bg-teal-400/25 blur-3xl animate-float-slow" aria-hidden="true" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:px-8 lg:py-20">
            <div className="animate-fade-up">
              {/* Tagline pill */}
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1.5 text-sm font-bold text-amber-300 shadow-glow-sm">
                <Sparkles className="h-4 w-4" />
                {t('landing.tagline')}
              </span>
              <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
                {t('landing.hero.title')}
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                {t('landing.hero.subtitle')}
              </p>

              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/70 px-3.5 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 sm:text-sm">
                <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                {t('landing.hero.proTypes')}
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => openModal('')}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:-translate-y-0.5 hover:from-amber-700 hover:to-amber-600 sm:w-auto"
                >
                  <MessageSquare className="h-4 w-4" />
                  {t('landing.hero.cta')}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </button>
                <button
                  type="button"
                  onClick={() => openModal('')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-base font-semibold text-slate-700 transition hover:border-amber-400 hover:text-amber-700 sm:w-auto"
                >
                  {t('landing.hero.ctaAlt')}
                </button>
              </div>

              <ul className="mt-8 grid grid-cols-2 gap-3 sm:max-w-lg">
                {TRUST.map(({ icon: Icon, key }) => (
                  <li key={key} className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <Icon className="h-4 w-4 shrink-0 text-emerald-600" />
                    {t(key)}
                  </li>
                ))}
              </ul>
            </div>

            {/* Inline form (immediate capture) */}
            <div className="animate-fade-up lg:pl-4 [animation-delay:120ms]">
              <div className="relative">
                <div className="pointer-events-none absolute -inset-3 -z-10 rounded-[2rem] bg-gradient-to-br from-amber-400/25 to-teal-400/25 blur-2xl" aria-hidden="true" />
                <LandingLeadForm source="Landing page" />
              </div>
            </div>
          </div>
        </section>

        {/* ===== TOP CATEGORIES (India) ===== */}
        <section className="bg-white py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {t('landing.cats.title')}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
                {t('landing.cats.subtitle')}
              </p>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {CATEGORIES.map(({ icon: Icon, key }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => openModal(t(key))}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-lg"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 transition group-hover:bg-amber-600 group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-slate-800">
                    {t(key)}
                  </span>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-amber-600" />
                </button>
              ))}
            </div>
            <p className="mt-6 text-center text-xs font-medium uppercase tracking-widest text-slate-400">
              {t('landing.cats.prompt')}
            </p>
          </div>
        </section>

        {/* ===== AREAS (infographic background) ===== */}
        <section className="relative overflow-hidden bg-slate-50 py-14 sm:py-20">
          {/* Decorative infographic backdrop */}
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-70" aria-hidden="true" />
          <Scale
            className="pointer-events-none absolute -right-10 top-10 h-64 w-64 text-amber-200/50"
            aria-hidden="true"
          />
          <Building2
            className="pointer-events-none absolute -left-10 bottom-0 h-56 w-56 text-teal-200/50"
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {t('landing.areas.title')}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
                {t('landing.areas.subtitle')}
              </p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {AREAS.map(({ icon: Icon, t: title, d }) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => openModal(t(title))}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:-translate-y-1 hover:border-teal-300 hover:shadow-glow-cyan"
                >
                  <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-teal-50 transition group-hover:scale-150" aria-hidden="true" />
                  <span className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-glow-cyan">
                    <Icon className="h-6 w-6" />
                  </span>
                  <p className="relative mt-4 text-base font-semibold text-slate-900">
                    {t(title)}
                  </p>
                  <p className="relative mt-1.5 text-sm text-slate-600">{t(d)}</p>
                  <span className="relative mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
                    {t('landing.cta.short')}
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ===== STORYBOARD (worry → clarity) ===== */}
        <section className="relative overflow-hidden bg-white py-14 sm:py-20">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" aria-hidden="true" />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {t('landing.story.title')}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
                {t('landing.story.subtitle')}
              </p>
            </div>

            <div className="mt-12 space-y-10 sm:space-y-14">
              {STORY.map(({ img, t: title, d }, i) => (
                <div
                  key={title}
                  className={`grid items-center gap-6 sm:grid-cols-2 sm:gap-10 ${
                    i % 2 === 1 ? 'sm:[&>*:first-child]:order-2' : ''
                  }`}
                >
                  {/* Frame image */}
                  <div className="group relative animate-fade-up">
                    <div className="pointer-events-none absolute -inset-2 -z-10 rounded-[1.75rem] bg-gradient-to-br from-amber-400/25 to-teal-400/25 blur-xl" aria-hidden="true" />
                    <div className="relative overflow-hidden rounded-3xl border border-slate-200 shadow-xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img}
                        alt=""
                        loading="lazy"
                        className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/25 to-transparent" aria-hidden="true" />
                      <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-amber-700 shadow">
                        {t('landing.story.step')} {i + 1}
                      </span>
                    </div>
                  </div>

                  {/* Copy */}
                  <div>
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-600 text-lg font-bold text-white shadow-glow-sm">
                      {i + 1}
                    </span>
                    <h3 className="mt-4 text-xl font-bold text-slate-900 sm:text-2xl">
                      {t(title)}
                    </h3>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
                      {t(d)}
                    </p>
                    {i === STORY.length - 1 && (
                      <button
                        type="button"
                        onClick={() => openModal('')}
                        className="group mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:-translate-y-0.5"
                      >
                        <MessageSquare className="h-4 w-4" />
                        {t('landing.hero.cta')}
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== WHY ===== */}
        <section className="bg-slate-50 py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t('landing.why.title')}
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {WHY.map(({ icon: Icon, t: title, d }) => (
                <div key={title} className="flex gap-4 rounded-2xl bg-white p-5 shadow-sm">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-slate-900">{t(title)}</p>
                    <p className="mt-1 text-sm text-slate-600">{t(d)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section className="bg-white py-14 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t('landing.faq.title')}
            </h2>
            <div className="mt-8 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200">
              {FAQS.map(({ q, a }) => (
                <details key={q} className="group bg-white open:bg-slate-50">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-slate-800 marker:content-none">
                    {t(q)}
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
                  </summary>
                  <p className="px-5 pb-4 text-sm leading-relaxed text-slate-600">
                    {t(a)}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ===== FINAL CTA ===== */}
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 py-16">
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-25"
            style={{ backgroundImage: `url(${IMAGES.ctaBg})` }}
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-900/85 to-slate-900/70" aria-hidden="true" />
          <div className="pointer-events-none absolute -left-16 top-0 h-56 w-56 rounded-full bg-amber-500/20 blur-3xl animate-pulse-glow" aria-hidden="true" />
          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <p className="text-sm font-bold uppercase tracking-widest text-amber-300">
              {t('landing.tagline')}
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {t('landing.final.title')}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300 sm:text-base">
              {t('landing.final.subtitle')}
            </p>
            <div className="mt-7 flex justify-center">
              <button
                type="button"
                onClick={() => openModal('')}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-7 py-4 text-base font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:-translate-y-0.5 hover:from-amber-700 hover:to-amber-600"
              >
                <MessageSquare className="h-4 w-4" />
                {t('landing.final.button')}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </section>

        {/* ===== BCI DISCLAIMER ===== */}
        <section className="bg-slate-50 py-8">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs leading-relaxed text-slate-400">
              {t('landing.disclaimer')}
            </p>
          </div>
        </section>
      </main>

      <Footer />

      <ConsultLeadModal
        open={modal.open}
        onClose={closeModal}
        prefillMessage={modal.prefill}
        source="Landing page"
      />
    </div>
  );
}
