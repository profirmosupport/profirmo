'use client';

import {
  LayoutDashboard,
  FileText,
  CalendarDays,
  MessageSquare,
  Settings,
  TrendingUp,
  Wallet,
  Users,
  Check,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

const SIDEBAR = [
  { icon: LayoutDashboard, labelKey: 'dashboardPreview.navOverview', active: true },
  { icon: FileText, labelKey: 'dashboardPreview.navCases' },
  { icon: CalendarDays, labelKey: 'dashboardPreview.navBookings' },
  { icon: MessageSquare, labelKey: 'dashboardPreview.navMessages' },
  { icon: Settings, labelKey: 'dashboardPreview.navSettings' },
];

const TILES = [
  { icon: FileText, labelKey: 'dashboardPreview.tileActiveCases', value: '4', accent: 'text-indigo-600 bg-indigo-50' },
  { icon: CalendarDays, labelKey: 'dashboardPreview.tileUpcoming', value: '2', accent: 'text-violet-600 bg-violet-50' },
  { icon: Wallet, labelKey: 'dashboardPreview.tileSpent', value: '₹8.4k', accent: 'text-blue-600 bg-blue-50' },
  { icon: Users, labelKey: 'dashboardPreview.tileConsultants', value: '6', accent: 'text-emerald-600 bg-emerald-50' },
];

const BARS = [62, 88, 45, 96, 71, 58, 80];

const ACTIVITY = [
  { nameKey: 'dashboardPreview.case1', tagKey: 'dashboardPreview.case1Tag', tone: 'amber' },
  { nameKey: 'dashboardPreview.case2', tagKey: 'dashboardPreview.case2Tag', tone: 'emerald' },
  { nameKey: 'dashboardPreview.case3', tagKey: 'dashboardPreview.case3Tag', tone: 'indigo' },
];

const TONE = {
  amber: 'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  indigo: 'bg-indigo-100 text-indigo-700',
};

const PERKS = [
  'dashboardPreview.perk1',
  'dashboardPreview.perk2',
  'dashboardPreview.perk3',
];

export default function DashboardPreviewSection() {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden bg-slate-950 py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-grid-dark opacity-70" aria-hidden="true" />
      <div
        className="pointer-events-none absolute left-1/2 top-10 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl animate-pulse-glow"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-300 ring-1 ring-inset ring-white/10">
            <LayoutDashboard className="h-3.5 w-3.5" />
            {t('dashboardPreview.eyebrow')}
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t('dashboardPreview.headingLead')}{' '}
            <span className="text-gradient-light">
              {t('dashboardPreview.headingHighlight')}
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            {t('dashboardPreview.subtext')}
          </p>
        </div>

        {/* Browser window */}
        <div className="relative mx-auto mt-14 max-w-5xl">
          <div
            className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-indigo-500/30 to-violet-500/30 blur-3xl"
            aria-hidden="true"
          />

          {/* Floating accent cards */}
          <div className="glass-dark absolute -left-6 top-20 hidden items-center gap-2.5 rounded-2xl p-3 shadow-glow animate-float lg:flex">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
              <Check className="h-4 w-4" strokeWidth={3} />
            </span>
            <div>
              <p className="text-xs font-semibold text-white">
                {t('dashboardPreview.cardResolved')}
              </p>
              <p className="text-[11px] text-slate-400">
                {t('dashboardPreview.cardResolvedTime')}
              </p>
            </div>
          </div>
          <div className="glass-dark absolute -right-6 bottom-16 hidden items-center gap-2.5 rounded-2xl p-3 shadow-glow animate-float-slow lg:flex">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-white">
                {t('dashboardPreview.cardMatchScore')}
              </p>
              <p className="text-[11px] text-slate-400">
                {t('dashboardPreview.cardConfidence')}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-glow">
            {/* Window top bar */}
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="mx-auto rounded-md bg-white px-4 py-1 text-xs text-slate-400">
                app.consultaipro.in/dashboard
              </span>
            </div>

            {/* App body */}
            <div className="flex">
              {/* Sidebar */}
              <aside className="hidden w-44 flex-shrink-0 flex-col gap-1 border-r border-slate-200 bg-slate-50 p-3 sm:flex">
                {SIDEBAR.map(({ icon: Icon, labelKey, active }) => (
                  <span
                    key={labelKey}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                      active
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-glow-sm'
                        : 'text-slate-500'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t(labelKey)}
                  </span>
                ))}
              </aside>

              {/* Main panel */}
              <div className="flex-1 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {t('dashboardPreview.welcome')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t('dashboardPreview.welcomeSub')}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    {t('dashboardPreview.live')}
                  </span>
                </div>

                {/* Stat tiles */}
                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {TILES.map(({ icon: Icon, labelKey, value, accent }) => (
                    <div
                      key={labelKey}
                      className="rounded-xl border border-slate-200 bg-white p-3"
                    >
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-lg ${accent}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <p className="mt-2 text-xl font-bold text-slate-900">
                        {value}
                      </p>
                      <p className="text-[11px] text-slate-500">{t(labelKey)}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-5">
                  {/* Analytics panel */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-900">
                        {t('dashboardPreview.activityTitle')}
                      </p>
                      <span className="text-[11px] font-medium text-emerald-600">
                        +18%
                      </span>
                    </div>
                    <div className="mt-4 flex h-28 items-end gap-2">
                      {BARS.map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 origin-bottom animate-rise-bar rounded-t-md bg-gradient-to-t from-indigo-600 to-violet-400"
                          style={{
                            height: `${h}%`,
                            animationDelay: `${i * 0.1}s`,
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Activity list */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
                    <p className="text-xs font-semibold text-slate-900">
                      {t('dashboardPreview.recentCases')}
                    </p>
                    <div className="mt-3 space-y-2.5">
                      {ACTIVITY.map((item) => (
                        <div
                          key={item.nameKey}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="truncate text-[11px] text-slate-600">
                            {t(item.nameKey)}
                          </span>
                          <span
                            className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TONE[item.tone]}`}
                          >
                            {t(item.tagKey)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Perks */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {PERKS.map((perkKey) => (
            <span
              key={perkKey}
              className="flex items-center gap-2 text-sm text-slate-300"
            >
              <span className="grid h-5 w-5 place-items-center rounded-md bg-emerald-500/20 text-emerald-400">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              {t(perkKey)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
