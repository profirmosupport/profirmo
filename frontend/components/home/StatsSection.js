'use client';

import {
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

const STATS = [
  {
    icon: ShieldCheck,
    // Verified-professional count. Bump this as live supply grows.
    value: '240+',
    labelKey: 'stats.verifiedConsultants',
    trendKey: 'stats.verifiedTrend',
    // mini-bar heights (0–1)
    bars: [0.4, 0.55, 0.5, 0.7, 0.65, 0.85, 1],
  },
  {
    icon: Sparkles,
    value: '50,000+',
    labelKey: 'stats.aiMatches',
    trendKey: 'stats.aiMatchesTrend',
    bars: [0.3, 0.45, 0.6, 0.55, 0.75, 0.9, 1],
  },
  {
    icon: Star,
    value: '4.9/5',
    labelKey: 'stats.avgRating',
    trendKey: 'stats.avgRatingTrend',
    bars: [0.7, 0.75, 0.78, 0.82, 0.88, 0.95, 1],
  },
  {
    icon: Timer,
    value: '12 min',
    labelKey: 'stats.avgMatchTime',
    trendKey: 'stats.avgMatchTimeTrend',
    bars: [1, 0.92, 0.84, 0.7, 0.6, 0.48, 0.4],
  },
];

function MiniBars({ bars }) {
  return (
    <div className="flex h-12 items-end gap-1.5" aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={i}
          className="flex-1 origin-bottom rounded-sm bg-gradient-to-t from-amber-200 to-amber-500 animate-rise-bar"
          style={{ height: `${Math.max(h * 100, 12)}%`, animationDelay: `${i * 0.09}s` }}
        />
      ))}
    </div>
  );
}

export default function StatsSection() {
  const { t } = useLanguage();

  return (
    <section className="bg-white pb-20 pt-10 sm:pb-24 sm:pt-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Dashboard panel */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 shadow-card-lg sm:p-8">
          <div
            className="pointer-events-none absolute inset-0 bg-grid opacity-60"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal-400/15 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-amber-400/15 blur-3xl"
            aria-hidden="true"
          />

          {/* Panel header */}
          <div className="relative flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-600">
                <Activity className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {t('stats.panelTitle')}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
                  </span>
                  {t('stats.panelStatus')}
                </p>
              </div>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 ring-1 ring-inset ring-teal-200">
              <TrendingUp className="h-3.5 w-3.5" />
              {t('stats.growthBadge')}
            </span>
          </div>

          {/* Metric cards */}
          <div className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map(({ icon: Icon, value, labelKey, trendKey, bars }) => (
              <div
                key={labelKey}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-glow-cyan"
              >
                <span
                  className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-amber-600 to-teal-500"
                  aria-hidden="true"
                />
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600 transition group-hover:bg-amber-600 group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                    <TrendingUp className="h-3 w-3" />
                    {t(trendKey)}
                  </span>
                </div>

                <p className="mt-4 text-3xl font-bold tracking-tight text-gradient sm:text-4xl">
                  {value}
                </p>
                <p className="mt-0.5 text-sm font-medium text-slate-600">
                  {t(labelKey)}
                </p>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <MiniBars bars={bars} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
