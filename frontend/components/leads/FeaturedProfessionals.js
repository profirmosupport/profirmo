'use client';

// FeaturedProfessionals — a strip of identity-verified professionals shown
// under the hero on /consult. Each card has a "Request a callback" button
// that opens the lead form (onCallback). Informational framing (no
// "hire the best" / superlatives) per BCI norms. Hides itself gracefully if
// the API is unreachable or returns nothing.

import { useEffect, useState } from 'react';
import { BadgeCheck, MapPin, Phone } from 'lucide-react';
import Avatar from '@/components/common/Avatar';
import RatingStars from '@/components/common/RatingStars';
import { useLanguage } from '@/components/LanguageProvider';
import { getAll as listProfessionals } from '@/services/professionalService';

function Card({ p, onCallback, callbackLabel }) {
  return (
    <div className="group relative w-[230px] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-1 hover:border-amber-300 hover:shadow-xl sm:w-auto">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-amber-50 to-transparent"
        aria-hidden="true"
      />
      <div className="relative mx-auto w-fit">
        <Avatar src={p.profilePhoto} name={p.name} size="lg" />
        {p.verified && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow">
            <BadgeCheck className="h-5 w-5 text-blue-600" />
          </span>
        )}
      </div>
      <p className="relative mt-3 truncate text-sm font-bold text-slate-900">
        {p.name}
      </p>
      <p className="relative truncate text-xs font-semibold text-amber-700">
        {p.professionalType}
      </p>
      {p.city && (
        <p className="relative mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="h-3 w-3" />
          {p.city}
        </p>
      )}
      <div className="relative mt-2 flex justify-center">
        <RatingStars rating={p.rating || 0} count={p.reviewsCount} size="sm" />
      </div>
      <button
        type="button"
        onClick={() => onCallback?.(p)}
        className="relative mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 px-3 py-2.5 text-sm font-semibold text-white shadow transition hover:from-amber-700 hover:to-amber-600"
      >
        <Phone className="h-4 w-4" />
        {callbackLabel}
      </button>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="w-[230px] shrink-0 animate-pulse rounded-2xl border border-slate-200 bg-white p-5 sm:w-auto">
      <div className="mx-auto h-14 w-14 rounded-full bg-slate-200" />
      <div className="mx-auto mt-3 h-3 w-24 rounded bg-slate-200" />
      <div className="mx-auto mt-2 h-3 w-20 rounded bg-slate-100" />
      <div className="mt-4 h-9 w-full rounded-lg bg-slate-200" />
    </div>
  );
}

export default function FeaturedProfessionals({ onCallback }) {
  const { t } = useLanguage();
  const [pros, setPros] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listProfessionals({ limit: 8, sort: 'featured' })
      .then((res) => {
        if (active) setPros((res.data || []).slice(0, 8));
      })
      .catch(() => {
        /* API unreachable — section hides below */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Nothing to show → render nothing (keeps the page clean).
  if (!loading && pros.length === 0) return null;

  const items = loading ? Array.from({ length: 4 }) : pros;

  return (
    <section className="relative bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {t('landing.featured.title')}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
            {t('landing.featured.subtitle')}
          </p>
        </div>

        <div className="mt-8 -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {items.map((p, i) =>
            p ? (
              <Card
                key={p.id}
                p={p}
                onCallback={onCallback}
                callbackLabel={t('landing.featured.callback')}
              />
            ) : (
              <Skeleton key={i} />
            )
          )}
        </div>
      </div>
    </section>
  );
}
