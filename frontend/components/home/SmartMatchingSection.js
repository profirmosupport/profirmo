'use client';

import { MessageSquareText, BrainCircuit, Sparkles, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

const STEPS = [
  {
    icon: MessageSquareText,
    titleKey: 'smartMatching.step1Title',
    descKey: 'smartMatching.step1Desc',
  },
  {
    icon: BrainCircuit,
    titleKey: 'smartMatching.step2Title',
    descKey: 'smartMatching.step2Desc',
  },
  {
    icon: Sparkles,
    titleKey: 'smartMatching.step3Title',
    descKey: 'smartMatching.step3Desc',
  },
];

export default function SmartMatchingSection() {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden bg-white py-20 sm:py-28">
      <div
        className="pointer-events-none absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-indigo-300/20 blur-3xl animate-pulse-glow"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-violet-300/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 ring-1 ring-inset ring-indigo-200">
            <BrainCircuit className="h-3.5 w-3.5" />
            {t('smartMatching.eyebrow')}
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t('smartMatching.headingLead')}{' '}
            <span className="text-gradient">
              {t('smartMatching.headingHighlight')}
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            {t('smartMatching.subtext')}
          </p>
        </div>

        <div className="relative mt-16">
          {/* Connecting animated line (desktop) */}
          <div
            className="absolute left-[16%] right-[16%] top-[3.25rem] hidden h-0.5 overflow-hidden rounded-full bg-slate-200 lg:block"
            aria-hidden="true"
          >
            <div className="h-full w-1/2 animate-marquee bg-gradient-to-r from-transparent via-indigo-500 to-transparent bg-200" />
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.titleKey}
                  className="group relative flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-glow-cyan"
                >
                  <span className="absolute -top-4 grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-glow-sm">
                    {i + 1}
                  </span>
                  <span className="mt-3 grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 transition group-hover:bg-gradient-to-br group-hover:from-indigo-600 group-hover:to-violet-600 group-hover:text-white">
                    <Icon className="h-7 w-7" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-slate-900">
                    {t(step.titleKey)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {t(step.descKey)}
                  </p>

                  {i < STEPS.length - 1 && (
                    <span
                      className="absolute -bottom-5 left-1/2 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full border border-slate-200 bg-white text-indigo-500 shadow-card lg:hidden"
                      aria-hidden="true"
                    >
                      <ArrowRight className="h-4 w-4 rotate-90" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
