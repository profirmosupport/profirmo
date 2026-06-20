// /services — index page listing all 15 service landings as icon cards.
// Server-rendered so we can emit proper SEO metadata; LeadGenFloater is the
// only client-side concern and is imported as a client component.

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import LeadGenFloater from '@/components/common/LeadGenFloater';
import { SERVICE_LANDINGS, ICONS } from '@/data/serviceLandings';

export const metadata = {
  title: 'All Legal & Tax Services · Pro Firmo',
  description:
    'Browse every Pro Firmo consultation service — property disputes, GST notices, ITR filing, divorce, legal notices, cheque bounce, startup law, company registration, trademarks, consumer complaints, NRI property, and more. Verified experts, AI-matched in minutes.',
  alternates: { canonical: '/services' },
};

const ACCENT = {
  amber: 'bg-amber-100 text-amber-700',
  teal: 'bg-teal-100 text-teal-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  rose: 'bg-rose-100 text-rose-700',
};

export default function ServicesIndexPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
          <div className="pointer-events-none absolute -right-32 top-0 h-72 w-72 rounded-full bg-amber-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -left-32 bottom-0 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-200">
              Pro Firmo · Services
            </span>
            <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
              Every consultation we offer, in one place.
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
              Pick the service that fits your situation. Each page covers the
              common problem, the documents you&apos;ll need, our process,
              and the cities our experts cover.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICE_LANDINGS.map((s) => {
              const Icon = ICONS[s.icon];
              return (
                <li key={s.slug}>
                  <Link
                    href={`/services/${s.slug}`}
                    className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          ACCENT[s.accent] || ACCENT.amber
                        }`}
                      >
                        {Icon ? <Icon size={18} /> : null}
                      </span>
                      <ArrowRight
                        size={16}
                        className="mt-2 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-amber-600"
                      />
                    </div>
                    <h2 className="mt-4 text-base font-semibold text-slate-900">
                      {s.title}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600">
                      {s.subtitle}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
      <Footer />
      <LeadGenFloater source="services-index" />
    </div>
  );
}
