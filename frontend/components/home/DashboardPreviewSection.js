'use client';

// DashboardPreviewSection — marketing-mock of the Pro Firmo professional
// dashboard, shown on the home page. Single browser-frame visual with:
//   - Sidebar nav (Cases, Clients, Calendar, Firm, Earnings)
//   - Top KPI strip
//   - Cases pipeline (kanban-lite)
//   - Today's calendar / bookings
//   - Client list
//   - Firm panel
// All content is static + marketing-only — labels are hardcoded in English
// because the live dashboard is a different, fully-i18n'd surface.

import {
  LayoutDashboard,
  Briefcase,
  Users,
  CalendarDays,
  Building2,
  Wallet,
  Settings,
  Check,
  ArrowUpRight,
  Bell,
  Search,
  Filter,
  ChevronDown,
  Plus,
  Video,
  Phone,
  MapPin,
  Clock,
  TrendingUp,
  Star,
  IndianRupee,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

const SIDEBAR = [
  { icon: LayoutDashboard, label: 'Overview', active: true },
  { icon: Briefcase, label: 'Cases', badge: 12 },
  { icon: Users, label: 'Clients', badge: 38 },
  { icon: CalendarDays, label: 'Calendar' },
  { icon: Building2, label: 'Firm' },
  { icon: Wallet, label: 'Earnings' },
  { icon: Settings, label: 'Settings' },
];

const KPIS = [
  { label: 'Open cases', value: '12', delta: '+3 this week', tone: 'indigo', icon: Briefcase },
  { label: 'Bookings this week', value: '7', delta: '2 today', tone: 'amber', icon: CalendarDays },
  { label: 'Active clients', value: '38', delta: '+4 mtd', tone: 'teal', icon: Users },
  { label: 'Pending payouts', value: '₹42,500', delta: 'next payout Fri', tone: 'rose', icon: IndianRupee },
];

const KPI_TONE = {
  indigo: { tile: 'bg-indigo-50 text-indigo-700', value: 'text-indigo-700' },
  amber: { tile: 'bg-amber-50 text-amber-700', value: 'text-amber-700' },
  teal: { tile: 'bg-teal-50 text-teal-700', value: 'text-teal-700' },
  rose: { tile: 'bg-rose-50 text-rose-700', value: 'text-rose-700' },
};

const PIPELINE = [
  {
    title: 'New',
    count: 3,
    tone: 'slate',
    cards: [
      { title: 'Property partition — Shah family', client: 'Rohan Shah', value: '₹25,000' },
      { title: 'GST notice §73 reply', client: 'Astra Pvt Ltd', value: '₹18,000' },
    ],
  },
  {
    title: 'In progress',
    count: 5,
    tone: 'amber',
    cards: [
      { title: 'Cheque bounce §138 case', client: 'A. Mehta', value: '₹40,000', due: 'Hearing Thu' },
      { title: 'ITR-3 capital gains restate', client: 'Singh & Co.', value: '₹15,000', due: 'Filing 28 Jun' },
    ],
  },
  {
    title: 'Awaiting client',
    count: 2,
    tone: 'sky',
    cards: [
      { title: 'NDA + employment contract', client: 'Northwind Labs', value: '₹12,000', due: 'Docs requested' },
    ],
  },
  {
    title: 'Closed',
    count: 2,
    tone: 'emerald',
    cards: [
      { title: 'Trademark TM-A filing', client: 'Verve Studio', value: '₹9,500', due: 'Filed' },
    ],
  },
];

const PIPELINE_TONE = {
  slate: 'bg-slate-100 text-slate-700',
  amber: 'bg-amber-100 text-amber-700',
  sky: 'bg-sky-100 text-sky-700',
  emerald: 'bg-emerald-100 text-emerald-700',
};

const TODAY = [
  { time: '10:30', who: 'Rohan Shah', topic: 'Partition consult', mode: 'video', accent: 'indigo' },
  { time: '12:00', who: 'Astra Pvt Ltd', topic: 'GST §73 strategy', mode: 'video', accent: 'amber' },
  { time: '15:00', who: 'A. Mehta', topic: 'Cheque-bounce hearing', mode: 'in-person', accent: 'rose' },
  { time: '17:30', who: 'New booking', topic: 'Discovery call', mode: 'phone', accent: 'teal' },
];

const TIME_TONE = {
  indigo: 'border-indigo-200 bg-indigo-50',
  amber: 'border-amber-200 bg-amber-50',
  rose: 'border-rose-200 bg-rose-50',
  teal: 'border-teal-200 bg-teal-50',
};

const MODE_ICON = {
  video: Video,
  phone: Phone,
  'in-person': MapPin,
};

const CLIENTS = [
  { name: 'Rohan Shah', label: 'Active', tone: 'emerald', meta: '3 open cases · Mumbai' },
  { name: 'Astra Pvt Ltd', label: 'Hot lead', tone: 'amber', meta: 'GST + secretarial · Bengaluru' },
  { name: 'A. Mehta', label: 'Litigation', tone: 'rose', meta: 'High-touch · NDX hearing Thu' },
  { name: 'Northwind Labs', label: 'New', tone: 'sky', meta: 'Onboarded 3d ago · Pune' },
];

const CLIENT_TONE = {
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  rose: 'bg-rose-100 text-rose-700',
  sky: 'bg-sky-100 text-sky-700',
};

const FIRM_MEMBERS = [
  { initials: 'PS', name: 'Priya Sharma', role: 'Owner', avail: true },
  { initials: 'RK', name: 'Rohit Kapoor', role: 'Co-owner', avail: true },
  { initials: 'AM', name: 'Anjali Mehta', role: 'Associate', avail: false },
];

const FEATURES = [
  'Case-pipeline + document storage',
  'Booking calendar with online + in-person modes',
  'Client list with full case history',
  'Firm panel — invite associates, share leads, share revenue',
  'Razorpay payouts straight to your bank',
  'WhatsApp + email notifications on every booking',
];

export default function DashboardPreviewSection() {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden bg-slate-950 py-20 sm:py-28">
      {/* Glow + grid backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-grid-dark opacity-70" aria-hidden="true" />
      <div className="pointer-events-none absolute left-1/2 top-10 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl animate-pulse-glow" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-20 bottom-20 h-72 w-72 rounded-full bg-teal-500/15 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-200">
            <LayoutDashboard size={12} />
            {t('dashboardPreview.eyebrow')}
          </span>
          <h2 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
            {t('dashboardPreview.headingLead')}{' '}
            <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-teal-300 bg-clip-text text-transparent">
              {t('dashboardPreview.headingHighlight')}
            </span>
          </h2>
          <p className="mt-4 text-base text-slate-300 sm:text-lg">
            {t('dashboardPreview.subtext')}
          </p>
        </div>

        {/* Browser-frame mock */}
        <div className="relative mx-auto mt-14 max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl shadow-indigo-900/40">
          {/* Window chrome */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-rose-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
            </div>
            <div className="hidden flex-1 max-w-md items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-[11px] text-slate-400 ring-1 ring-slate-200 sm:flex">
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-700">🔒</span>
              profirmo.com/dashboard/professional
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Bell size={13} className="text-slate-400" />
              <span className="hidden sm:inline">3 new</span>
            </div>
          </div>

          {/* Sidebar + main grid */}
          <div className="grid grid-cols-[64px,1fr] gap-0 lg:grid-cols-[200px,1fr]">
            {/* Sidebar */}
            <aside className="border-r border-slate-200 bg-slate-50/60 px-2 py-4 lg:px-3">
              <p className="hidden px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 lg:block">
                Practice
              </p>
              <ul className="mt-2 space-y-0.5">
                {SIDEBAR.map(({ icon: Icon, label, active, badge }) => (
                  <li key={label}>
                    <span
                      className={`flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-xs font-medium transition ${
                        active
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-200/60'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon size={14} />
                        <span className="hidden lg:inline">{label}</span>
                      </span>
                      {badge && (
                        <span
                          className={`hidden rounded-full px-1.5 py-0.5 text-[10px] font-semibold lg:inline-flex ${
                            active
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {badge}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 hidden rounded-xl border border-slate-200 bg-white p-3 lg:block">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  This week
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  ₹68,500
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                  <TrendingUp size={11} />
                  +14% vs last
                </p>
              </div>
            </aside>

            {/* Main */}
            <div className="min-w-0 px-4 py-5 sm:px-5 lg:px-6">
              {/* Top bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Welcome back, Priya
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {KPIS[0].value} open cases · 4 bookings today
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-500 sm:inline-flex">
                    <Search size={12} />
                    Search cases, clients…
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-[11px] font-semibold text-slate-900 shadow">
                    <Plus size={12} />
                    New case
                  </span>
                </div>
              </div>

              {/* KPI strip */}
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {KPIS.map(({ label, value, delta, tone, icon: Icon }) => {
                  const t2 = KPI_TONE[tone] || KPI_TONE.indigo;
                  return (
                    <div
                      key={label}
                      className="rounded-xl border border-slate-200 bg-white p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`grid h-7 w-7 place-items-center rounded-lg ${t2.tile}`}
                        >
                          <Icon size={13} />
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {delta}
                        </span>
                      </div>
                      <p className={`mt-2 text-lg font-bold ${t2.value}`}>
                        {value}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {label}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Cases pipeline */}
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Cases pipeline
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <Filter size={11} />
                    All · This month
                    <ChevronDown size={11} />
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {PIPELINE.map((col) => (
                    <div
                      key={col.title}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-700">
                          {col.title}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                            PIPELINE_TONE[col.tone] || PIPELINE_TONE.slate
                          }`}
                        >
                          {col.count}
                        </span>
                      </div>
                      <ul className="mt-2 space-y-1.5">
                        {col.cards.map((card) => (
                          <li
                            key={card.title}
                            className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm"
                          >
                            <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-slate-800">
                              {card.title}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-500">
                              {card.client}
                            </p>
                            <div className="mt-1.5 flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold text-slate-800">
                                {card.value}
                              </span>
                              {card.due && (
                                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                                  {card.due}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Two-up: Today's schedule + Clients */}
              <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
                {/* Today's bookings */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Today
                    </h3>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                      <Clock size={10} />
                      4 bookings
                    </span>
                  </div>
                  <ul className="mt-2.5 space-y-1.5">
                    {TODAY.map((slot) => {
                      const Icon = MODE_ICON[slot.mode] || Video;
                      return (
                        <li
                          key={`${slot.time}-${slot.who}`}
                          className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 ${
                            TIME_TONE[slot.accent] || TIME_TONE.indigo
                          }`}
                        >
                          <span className="text-[11px] font-bold text-slate-800">
                            {slot.time}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-semibold text-slate-900">
                              {slot.who}
                            </p>
                            <p className="truncate text-[10px] text-slate-600">
                              {slot.topic}
                            </p>
                          </div>
                          <Icon size={12} className="shrink-0 text-slate-500" />
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                    Availability open · Mon-Fri 09:00-19:00
                    <ArrowUpRight size={10} />
                  </p>
                </div>

                {/* Clients */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Recent clients
                    </h3>
                    <span className="text-[10px] font-semibold text-slate-500">
                      38 active
                    </span>
                  </div>
                  <ul className="mt-2.5 space-y-1.5">
                    {CLIENTS.map((c) => (
                      <li
                        key={c.name}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-semibold text-slate-900">
                            {c.name}
                          </p>
                          <p className="truncate text-[10px] text-slate-500">
                            {c.meta}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                            CLIENT_TONE[c.tone] || CLIENT_TONE.emerald
                          }`}
                        >
                          {c.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Firm strip */}
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500">
                    <Building2 size={12} />
                    Your firm — Sharma & Associates
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                    <Star size={10} className="fill-amber-500 text-amber-500" />
                    4.9 · 312 reviews
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {FIRM_MEMBERS.map((m) => (
                    <div
                      key={m.initials}
                      className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/40 px-2 py-1.5"
                    >
                      <span className="relative grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-amber-500 to-teal-600 text-[10px] font-bold text-white">
                        {m.initials}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-white ${
                            m.avail ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-slate-900">
                          {m.name}
                        </p>
                        <p className="text-[10px] text-slate-500">{m.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature checklist below the screen */}
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f}
              className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
            >
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
                <Check size={12} />
              </span>
              <p className="text-sm leading-relaxed text-slate-200">{f}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
