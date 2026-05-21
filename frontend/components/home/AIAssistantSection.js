'use client';

import Link from 'next/link';
import {
  Sparkles,
  Check,
  Star,
  MessageSquareText,
  FileText,
  Lightbulb,
  ShieldCheck,
  ArrowRight,
  BadgeCheck,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

const CHECKLIST = [
  'aiAssistant.checklist1',
  'aiAssistant.checklist2',
  'aiAssistant.checklist3',
];

const MATCHES = [
  { img: 14, name: 'Ananya Iyer', role: 'GST Consultant', rating: '4.9' },
  { img: 33, name: 'Vikram Singh', role: 'Tax Consultant', rating: '4.8' },
  { img: 60, name: 'Meera Joshi', role: 'Income Tax Consultant', rating: '4.9' },
];

const FEATURES = [
  {
    icon: MessageSquareText,
    titleKey: 'aiAssistant.feature1Title',
    descKey: 'aiAssistant.feature1Desc',
  },
  {
    icon: FileText,
    titleKey: 'aiAssistant.feature2Title',
    descKey: 'aiAssistant.feature2Desc',
  },
  {
    icon: Lightbulb,
    titleKey: 'aiAssistant.feature3Title',
    descKey: 'aiAssistant.feature3Desc',
  },
  {
    icon: ShieldCheck,
    titleKey: 'aiAssistant.feature4Title',
    descKey: 'aiAssistant.feature4Desc',
  },
];

export default function AIAssistantSection() {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden bg-slate-950 py-20 sm:py-28">
      <div
        className="pointer-events-none absolute inset-0 bg-grid-dark opacity-70"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-amber-600/25 blur-3xl animate-pulse-glow"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-teal-500/20 blur-3xl animate-float-slow"
        aria-hidden="true"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        {/* LEFT — assistant preview */}
        <div className="relative">
          <div
            className="pointer-events-none absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-amber-500/20 to-teal-400/20 blur-2xl"
            aria-hidden="true"
          />

          {/* Floating accent chips */}
          <div className="pointer-events-none absolute -left-3 top-14 z-20 hidden animate-float sm:block">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/95 px-3 py-1.5 text-xs font-semibold text-white shadow-glow-cyan">
              <BadgeCheck className="h-3.5 w-3.5" />
              {t('aiAssistant.chipVerified')}
            </span>
          </div>
          <div
            className="pointer-events-none absolute -right-3 top-2 z-20 hidden animate-float-slow sm:block"
            style={{ animationDelay: '0.8s' }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/95 px-3 py-1.5 text-xs font-semibold text-white shadow-glow">
              <Sparkles className="h-3.5 w-3.5" />
              {t('aiAssistant.chipExperts')}
            </span>
          </div>
          <div
            className="pointer-events-none absolute -bottom-3 right-10 z-20 hidden animate-float sm:block"
            style={{ animationDelay: '1.4s' }}
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-teal-400 text-slate-950 shadow-glow-cyan">
              <Sparkles className="h-4 w-4" />
            </span>
          </div>

          <div className="glass-dark relative rounded-3xl p-5 shadow-glow">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              {/* Animated avatar with conic halo */}
              <span className="relative grid h-12 w-12 place-items-center">
                <span
                  className="absolute inset-0 rounded-2xl bg-amber-500/40 blur-md animate-pulse-glow"
                  aria-hidden="true"
                />
                <span
                  className="absolute inset-[-3px] rounded-[1.05rem] animate-spin-slow"
                  style={{
                    background:
                      'conic-gradient(from 0deg, #14b8a6, #d97706, #f59e0b, #14b8a6)',
                  }}
                  aria-hidden="true"
                />
                <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-slate-900">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-600 to-amber-500">
                    <Sparkles className="h-4.5 w-4.5 text-white" />
                  </span>
                </span>
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">
                  {t('aiAssistant.assistantName')}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-teal-400">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
                  </span>
                  {t('aiAssistant.assistantStatus')}
                </p>
              </div>
            </div>

            {/* "AI is analyzing" shimmer bar */}
            <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
              <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
              <div className="flex-1">
                <p className="text-[11px] font-medium text-slate-300">
                  {t('aiAssistant.analyzing')}
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full w-full animate-shimmer rounded-full bg-200"
                    style={{
                      backgroundImage:
                        'linear-gradient(90deg, rgba(20,184,166,0.2) 0%, #14b8a6 35%, #f59e0b 65%, rgba(217,119,6,0.2) 100%)',
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <div className="flex justify-end">
                <p className="max-w-[82%] rounded-2xl rounded-br-md bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-2.5 text-sm text-white">
                  {t('aiAssistant.chatUser')}
                </p>
              </div>

              <div className="flex justify-start">
                <p className="max-w-[88%] rounded-2xl rounded-bl-md bg-white/10 px-4 py-2.5 text-sm text-slate-200">
                  {t('aiAssistant.chatBot1')}
                </p>
              </div>

              {/* Checklist */}
              <div className="ml-1 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
                {CHECKLIST.map((itemKey) => (
                  <div
                    key={itemKey}
                    className="flex items-center gap-2.5 text-sm text-slate-200"
                  >
                    <span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-md bg-teal-500/20 text-teal-400">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {t(itemKey)}
                  </div>
                ))}
              </div>

              <div className="flex justify-start">
                <p className="max-w-[88%] rounded-2xl rounded-bl-md bg-white/10 px-4 py-2.5 text-sm text-slate-200">
                  {t('aiAssistant.chatBot2Lead')}{' '}
                  <span className="font-semibold text-amber-300">
                    {t('aiAssistant.chatBot2Match')}
                  </span>
                  :
                </p>
              </div>

              {/* Match rows */}
              <div className="space-y-2">
                {MATCHES.map((m) => (
                  <div
                    key={m.name}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2.5 transition hover:border-teal-400/40 hover:bg-white/10"
                  >
                    <span className="h-9 w-9 overflow-hidden rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 ring-1 ring-white/20">
                      <img
                        src={`https://i.pravatar.cc/80?img=${m.img}`}
                        alt={m.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-sm font-semibold text-white">
                        {m.name}
                        <BadgeCheck className="h-3.5 w-3.5 text-teal-400" />
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {m.role}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-400">
                      <Star className="h-3 w-3 fill-amber-400" />
                      {m.rating}
                    </span>
                  </div>
                ))}
              </div>

              {/* Typing indicator */}
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-white/10 px-4 py-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-2 w-2 rounded-full bg-teal-300 animate-typing"
                      style={{ animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — copy + features */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300 ring-1 ring-inset ring-white/10">
            <Sparkles className="h-3.5 w-3.5" />
            {t('aiAssistant.eyebrow')}
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t('aiAssistant.headingLead')}{' '}
            <span className="text-gradient-light">
              {t('aiAssistant.headingHighlight')}
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            {t('aiAssistant.subtext')}
          </p>

          <div className="mt-8 space-y-3">
            {FEATURES.map(({ icon: Icon, titleKey, descKey }) => (
              <div
                key={titleKey}
                className="glass-dark group flex gap-4 rounded-2xl p-4 transition hover:border-teal-400/30 hover:bg-white/10"
              >
                <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-600 to-amber-500 text-white shadow-glow-sm transition group-hover:from-teal-500 group-hover:to-teal-600">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {t(titleKey)}
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">{t(descKey)}</p>
                </div>
              </div>
            ))}
          </div>

          <Link
            href="/search"
            className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-glow-sm transition hover:-translate-y-0.5 hover:shadow-glow"
          >
            {t('aiAssistant.cta')}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
