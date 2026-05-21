'use client';

import Link from 'next/link';
import { MapPin, Users, Star, ArrowRight, Building2 } from 'lucide-react';
import { firms } from '@/data/mockData';
import { getInitials } from '@/utils/formatters';
import { useLanguage } from '@/components/LanguageProvider';

function FirmLogo({ firm }) {
  return (
    <span className="relative grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-600 to-amber-500 shadow-glow-sm">
      <span className="text-base font-bold tracking-tight text-white">
        {getInitials(firm.name)}
      </span>
      <span
        className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border-2 border-white bg-teal-500"
        aria-hidden="true"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
      </span>
    </span>
  );
}

function FirmCard({ firm }) {
  const { t } = useLanguage();
  const isLegal = firm.firmType === 'Legal Firm';
  return (
    <div className="group relative flex w-[20rem] flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-glow-cyan sm:w-[22rem]">
      <span
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-teal-500/0 blur-2xl transition-all duration-300 group-hover:bg-teal-500/15"
        aria-hidden="true"
      />

      <div className="flex items-start gap-4">
        <FirmLogo firm={firm} />
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-base font-semibold text-slate-900">
            {firm.name}
          </h4>
          <span
            className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              isLegal
                ? 'bg-amber-50 text-amber-700'
                : 'bg-teal-50 text-teal-700'
            }`}
          >
            {firm.firmType}
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {firm.city}
        </span>
        <span className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          <span className="font-semibold text-slate-700">{firm.rating}</span>
          ({firm.reviewsCount})
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {firm.professionalCount} {t('featuredFirms.professionals')}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {firm.services.slice(0, 3).map((service) => (
          <span
            key={service}
            className="rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600"
          >
            {service}
          </span>
        ))}
      </div>

      <Link
        href={`/firms/${firm.id}`}
        className="group/link mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 transition hover:text-amber-700"
      >
        {t('featuredFirms.viewFirm')}
        <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-0.5" />
      </Link>
    </div>
  );
}

export default function FeaturedFirms() {
  const { t } = useLanguage();
  // Only ~4 firms — repeat enough times to fill a seamless marquee row.
  const row = [...firms, ...firms, ...firms];
  // Render the row twice so the -50% marquee loop is seamless.
  const marqueeItems = [...row, ...row];

  return (
    <section className="overflow-hidden bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-200">
            <Building2 className="h-3.5 w-3.5" />
            {t('featuredFirms.eyebrow')}
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t('featuredFirms.heading')}
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            {t('featuredFirms.subtext')}
          </p>
        </div>
      </div>

      {/* Auto-scrolling marquee */}
      <div className="group relative mt-14">
        {/* Edge fade masks */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-slate-50 to-transparent sm:w-32"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-slate-50 to-transparent sm:w-32"
          aria-hidden="true"
        />

        <div className="overflow-hidden">
          <div className="pause-on-hover flex w-max gap-6 px-3 animate-marquee">
            {marqueeItems.map((firm, i) => (
              <FirmCard key={`${firm.id}-${i}`} firm={firm} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
