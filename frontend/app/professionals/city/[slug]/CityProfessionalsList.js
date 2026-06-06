'use client';

// CityProfessionalsList — client-side body of the SEO city landing
// page. Pulls the public /api/professionals listing scoped to a single
// `cityId` and renders the cards. Keeps the page lightweight: no
// sidebar filters or sort controls — just the grid, plus a "View
// every professional in <city>" CTA that drops the visitor onto the
// full /professionals filter UI with the city pre-selected.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';
import ProfessionalCard from '@/components/professionals/ProfessionalCard';
import EmptyState from '@/components/common/EmptyState';
import NoResultsFallback from '@/components/professionals/NoResultsFallback';
import { getAll as listProfessionals } from '@/services/professionalService';

const CITY_PAGE_LIMIT = 24;

export default function CityProfessionalsList({ cityId, cityName }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!cityId) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    listProfessionals({ city: cityId, limit: CITY_PAGE_LIMIT, sort: 'featured' })
      .then((res) => {
        if (!active) return;
        setItems(Array.isArray(res && res.data) ? res.data : []);
        setTotal((res && res.meta && res.meta.total) || (res && res.data && res.data.length) || 0);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Failed to load professionals.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cityId]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<Search size={24} />}
          title="Unable to load this city"
          description={error}
        />
      ) : items.length === 0 ? (
        <NoResultsFallback />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{total}</span>{' '}
              {total === 1 ? 'professional' : 'professionals'} listed in{' '}
              <span className="font-semibold text-slate-900">{cityName}</span>
            </p>
            <Link
              href={`/professionals?city=${encodeURIComponent(cityId)}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-800"
            >
              View all in {cityName}
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((pro) => (
              <ProfessionalCard key={pro.id} professional={pro} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
