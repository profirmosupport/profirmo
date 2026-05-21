'use client';

import {
  MessagesSquare,
  ListChecks,
  CalendarCheck,
  Video,
  Workflow,
  BadgeCheck,
  Star,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

const STEPS = [
  { icon: MessagesSquare, titleKey: 'howItWorks.step1Title', descKey: 'howItWorks.step1Desc' },
  { icon: ListChecks, titleKey: 'howItWorks.step2Title', descKey: 'howItWorks.step2Desc' },
  { icon: CalendarCheck, titleKey: 'howItWorks.step3Title', descKey: 'howItWorks.step3Desc' },
  { icon: Video, titleKey: 'howItWorks.step4Title', descKey: 'howItWorks.step4Desc' },
];

// Fixed pravatar ids — always render real human faces.
const TEAM_AVATARS = [16, 5, 36, 48];

export default function HowItWorksSection() {
  const { t } = useLanguage();

  return (
    <section className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 ring-1 ring-inset ring-indigo-200">
            <Workflow className="h-3.5 w-3.5" />
            {t('howItWorks.eyebrow')}
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t('howItWorks.heading')}
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            {t('howItWorks.subtext')}
          </p>
        </div>

        <div className="mt-16 grid items-center gap-10 lg:grid-cols-[22rem_1fr] lg:gap-12">
          {/* Consultant portrait — real human figure via pravatar */}
          <div className="relative mx-auto w-full max-w-sm">
            <div
              className="pointer-events-none absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-amber-500/25 via-amber-400/15 to-teal-400/25 blur-2xl"
              aria-hidden="true"
            />
            {/* Framed portrait sits on a solid brand gradient base */}
            <div className="overflow-hidden rounded-3xl border border-white bg-gradient-to-br from-amber-100 via-white to-teal-100 p-2 shadow-card-lg">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950">
                {/* Atmospheric background photo behind the dark gradient */}
                <img
                  src="https://picsum.photos/seed/profirmo-how/640/760"
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-40"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-transparent"
                  aria-hidden="true"
                />
                {/* The consultant face — guaranteed real human */}
                <img
                  src="https://i.pravatar.cc/520?img=20"
                  alt={t('howItWorks.consultantAlt')}
                  loading="lazy"
                  className="relative h-80 w-full object-cover"
                />
                {/* Caption card */}
                <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/95 p-3 shadow-card backdrop-blur">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-slate-900">
                      {t('howItWorks.consultantName')}
                    </p>
                    <BadgeCheck className="h-4 w-4 text-indigo-500" />
                  </div>
                  <p className="text-xs font-medium text-indigo-600">
                    {t('howItWorks.consultantRole')}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    4.9 · {t('howItWorks.consultantBadge')}
                  </p>
                </div>
              </div>
            </div>

            {/* Small consultant cluster — more real faces */}
            <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-card">
              <div className="flex -space-x-3">
                {TEAM_AVATARS.map((n) => (
                  <span
                    key={n}
                    className="h-9 w-9 overflow-hidden rounded-full bg-gradient-to-br from-amber-400 to-teal-400 ring-2 ring-white"
                  >
                    <img
                      src={`https://i.pravatar.cc/80?img=${n}`}
                      alt={t('howItWorks.consultantAlt')}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </span>
                ))}
              </div>
              <p className="text-xs font-medium text-slate-600">
                {t('howItWorks.teamLabel')}
              </p>
            </div>

            <p className="mt-3 text-center text-sm text-slate-500">
              {t('howItWorks.consultantCaption')}
            </p>
          </div>

          {/* Steps */}
          <div className="grid gap-6 sm:grid-cols-2">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.titleKey}
                  className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-glow-cyan"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:bg-gradient-to-br group-hover:from-indigo-600 group-hover:to-violet-600 group-hover:text-white">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="bg-gradient-to-br from-indigo-200 to-violet-200 bg-clip-text text-5xl font-bold text-transparent">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-slate-900">
                    {t(step.titleKey)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {t(step.descKey)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
