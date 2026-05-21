'use client';

import Link from 'next/link';
import { BadgeCheck, MapPin, Star, ArrowRight, Sparkles } from 'lucide-react';
import { professionals } from '@/data/mockData';
import { formatRate, truncate } from '@/utils/formatters';
import { useLanguage } from '@/components/LanguageProvider';

// Deterministic pravatar id per professional index.
const AVATAR_IDS = [11, 13, 15, 22, 25, 31, 38, 41, 47, 52, 58, 64];

export default function FeaturedProfessionals() {
  const { t } = useLanguage();
  const featured = [...professionals]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 6);

  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 ring-1 ring-inset ring-indigo-200">
              <Sparkles className="h-3.5 w-3.5" />
              {t('featuredProfessionals.eyebrow')}
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {t('featuredProfessionals.heading')}
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              {t('featuredProfessionals.subtext')}
            </p>
          </div>
          <Link
            href="/professionals"
            className="group inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-card transition hover:-translate-y-0.5 hover:border-teal-300 hover:text-teal-700"
          >
            {t('featuredProfessionals.viewAll')}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((pro) => {
            const proIndex = professionals.findIndex((p) => p.id === pro.id);
            const avatarId = AVATAR_IDS[proIndex % AVATAR_IDS.length];
            return (
              <div
                key={pro.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-glow-cyan"
              >
                <span
                  className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-teal-500/0 blur-2xl transition-all duration-300 group-hover:bg-teal-500/15"
                  aria-hidden="true"
                />

                <div className="flex items-start gap-4">
                  <div className="relative">
                    <div className="h-16 w-16 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 ring-2 ring-indigo-100">
                      <img
                        src={`https://i.pravatar.cc/200?img=${avatarId}`}
                        alt={`${pro.name}, ${pro.professionType}`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    {pro.availableNow && (
                      <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white">
                        <span className="relative flex h-3 w-3">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-base font-semibold text-slate-900">
                        {pro.name}
                      </h3>
                      {pro.verified && (
                        <BadgeCheck className="h-4 w-4 flex-shrink-0 text-indigo-500" />
                      )}
                    </div>
                    <p className="text-sm font-medium text-indigo-600">
                      {pro.professionType}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3 w-3" />
                      {pro.city}
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-sm text-slate-600">
                  {truncate(pro.specialization, 60)}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="flex items-center gap-1 text-sm">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-slate-900">
                      {pro.rating}
                    </span>
                    <span className="text-slate-400">
                      ({pro.reviewsCount})
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatRate(pro.perMinuteRate)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link
                    href={`/professionals/${pro.id}`}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
                  >
                    {t('featuredProfessionals.viewProfile')}
                  </Link>
                  <Link
                    href={`/professionals/${pro.id}`}
                    className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-center text-sm font-semibold text-white shadow-glow-sm transition hover:shadow-glow"
                  >
                    {t('featuredProfessionals.book')}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
