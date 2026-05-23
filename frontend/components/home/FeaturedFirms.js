'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Users, Star, ArrowRight, Building2 } from 'lucide-react';
import Avatar from '@/components/common/Avatar';
import firmService from '@/services/firmService';
import { useLanguage } from '@/components/LanguageProvider';

function FirmCard({ firm }) {
  const { t } = useLanguage();
  const isLegal = firm.firmType === 'Legal Firm';
  const areas = Array.isArray(firm.practiceAreas) ? firm.practiceAreas : [];
  return (
    <div className="group relative flex w-[20rem] flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-glow-cyan sm:w-[22rem]">
      <span
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-teal-500/0 blur-2xl transition-all duration-300 group-hover:bg-teal-500/15"
        aria-hidden="true"
      />

      <div className="flex items-start gap-4">
        <Avatar
          src={firm.logo}
          name={firm.firmName}
          size="lg"
          className="rounded-2xl"
        />
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-base font-semibold text-slate-900">
            {firm.firmName}
          </h4>
          {firm.firmType && (
            <span
              className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                isLegal
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-teal-50 text-teal-700'
              }`}
            >
              {firm.firmType}
            </span>
          )}
          {firm.owner && firm.owner.name && (
            <p className="mt-1 text-xs text-slate-500">
              Owned by{' '}
              <span className="font-medium text-slate-700">
                {firm.owner.name}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
        {firm.city && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {firm.city}
          </span>
        )}
        {(firm.reviewsCount || 0) > 0 ? (
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-slate-700">
              {firm.rating || 0}
            </span>
            ({firm.reviewsCount})
          </span>
        ) : (
          <span className="flex items-center gap-1 text-slate-400">
            <Star
              className="h-3.5 w-3.5 text-slate-300"
              fill="currentColor"
            />
            {t('profCmp.noReviewYet')}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {firm.professionalCount || 0} {t('featuredFirms.professionals')}
        </span>
      </div>

      {areas.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {areas.slice(0, 3).map((area) => (
            <span
              key={area}
              className="rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600"
            >
              {area}
            </span>
          ))}
        </div>
      )}

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

function FirmCardSkeleton() {
  return (
    <div className="flex w-[20rem] flex-shrink-0 flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:w-[22rem]">
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 animate-pulse rounded-2xl bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

export default function FeaturedFirms() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await firmService.getAll({ limit: 4, sort: 'rating' });
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

  // Repeat the fetched firms enough times to fill a seamless marquee row,
  // then render it twice so the -50% loop is seamless.
  const row = items.length > 0 ? [...items, ...items, ...items] : [];
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

      {loading ? (
        <div className="mt-14 flex gap-6 overflow-hidden px-3">
          {[0, 1, 2, 3].map((i) => (
            <FirmCardSkeleton key={i} />
          ))}
        </div>
      ) : error || items.length === 0 ? (
        <div className="mx-auto mt-14 max-w-2xl rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            {error
              ? 'Unable to load firms right now. Please try again later.'
              : 'No firms are listed yet. Check back soon.'}
          </p>
        </div>
      ) : (
        /* Auto-scrolling marquee */
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
      )}
    </section>
  );
}
