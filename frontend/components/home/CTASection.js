'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles, ShieldCheck, Clock, BadgeCheck } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

// Fixed pravatar ids — always render real human faces.
const CONSULTANT_CLUSTER = [11, 32, 13, 47, 56];

export default function CTASection() {
  const { t } = useLanguage();

  return (
    <section className="bg-slate-950 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Dark base so a failed image load still looks intentional */}
        <div className="relative isolate overflow-hidden rounded-3xl bg-slate-950 px-6 py-16 shadow-glow sm:px-12 sm:py-24">
          {/* Atmospheric background photo */}
          <img
            src="https://picsum.photos/seed/profirmo-cta/1600/1000"
            alt={t('cta.bgAlt')}
            loading="lazy"
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
          {/* Strong dark gradient overlay for legibility */}
          <div
            className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-950/95 via-slate-900/92 to-amber-950/85"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-grid-dark opacity-40"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -left-16 -top-16 -z-10 h-72 w-72 rounded-full bg-amber-500/25 blur-3xl animate-pulse-glow"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-20 -right-10 -z-10 h-72 w-72 rounded-full bg-teal-500/25 blur-3xl animate-float-slow"
            aria-hidden="true"
          />

          <div className="grid items-center gap-12 lg:grid-cols-[1fr_22rem]">
            {/* LEFT — copy */}
            <div className="relative mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-200 ring-1 ring-inset ring-white/20 backdrop-blur">
                <Clock className="h-3.5 w-3.5" />
                {t('cta.eyebrow')}
              </span>

              <h2 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-5xl">
                {t('cta.headingLead')}{' '}
                <span className="text-gradient-light">
                  {t('cta.headingHighlight')}
                </span>
              </h2>
              <p className="mt-4 text-lg text-slate-300">
                {t('cta.subtext')}
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <Link
                  href="/auth/register-client"
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-7 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5 hover:shadow-glow sm:w-auto"
                >
                  {t('cta.getStarted')}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/auth/register-professional"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:border-teal-300/60 hover:bg-white/20 sm:w-auto"
                >
                  {t('cta.joinPro')}
                </Link>
              </div>

              <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-300 lg:justify-start">
                <ShieldCheck className="h-4 w-4 text-teal-400" />
                {t('cta.note')}
              </p>
            </div>

            {/* RIGHT — consultant imagery (real human figures via pravatar) */}
            <div className="relative mx-auto w-full max-w-sm">
              <div
                className="pointer-events-none absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-amber-500/30 to-teal-400/30 blur-2xl"
                aria-hidden="true"
              />

              {/* Framed consultant portrait on a solid brand gradient */}
              <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-amber-600 to-amber-500 p-1.5 shadow-glow">
                <div className="relative overflow-hidden rounded-[1.35rem] bg-slate-900">
                  <img
                    src="https://i.pravatar.cc/520?img=33"
                    alt={t('cta.consultantAlt')}
                    loading="lazy"
                    className="h-64 w-full object-cover"
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent"
                    aria-hidden="true"
                  />
                  <div className="absolute inset-x-3 bottom-3 flex items-center gap-1.5">
                    <div>
                      <p className="flex items-center gap-1 text-sm font-semibold text-white">
                        {t('cta.consultantName')}
                        <BadgeCheck className="h-4 w-4 text-teal-300" />
                      </p>
                      <p className="text-xs font-medium text-amber-200">
                        {t('cta.consultantRole')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Consultant cluster — more real faces, on a solid card */}
              <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
                <div className="flex -space-x-3">
                  {CONSULTANT_CLUSTER.map((n) => (
                    <span
                      key={n}
                      className="h-9 w-9 overflow-hidden rounded-full bg-gradient-to-br from-amber-500 to-teal-500 ring-2 ring-slate-900"
                    >
                      <img
                        src={`https://i.pravatar.cc/80?img=${n}`}
                        alt={t('cta.consultantAlt')}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </span>
                  ))}
                </div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
                  </span>
                  {t('cta.consultantsBadge')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
