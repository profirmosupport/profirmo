'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import ProfessionalCard from '@/components/professionals/ProfessionalCard';
import professionalService from '@/services/professionalService';
import { useLanguage } from '@/components/LanguageProvider';

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 animate-pulse rounded-2xl bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
      <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function FeaturedProfessionals() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Curated by the admin via the "Featured" toggle in
        // /admin/professionals — not ranked by rating. Bar Council of
        // India advertising rules don't permit "top/best/highest rated"
        // language; the home page is a directory of admin-picked
        // entries, ordered alphabetically once filtered.
        const res = await professionalService.getAll({
          limit: 6,
          featured: true,
          sort: 'featured',
        });
        if (!active) return;
        setItems(Array.isArray(res && res.data) ? res.data : []);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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

        {loading ? (
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : error || items.length === 0 ? (
          <div className="mt-14 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
            <p className="text-sm text-slate-500">
              {error
                ? 'Unable to load professionals right now. Please try again later.'
                : 'No professionals are listed yet. Check back soon.'}
            </p>
          </div>
        ) : (
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((pro) => (
              <ProfessionalCard key={pro.id} professional={pro} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
