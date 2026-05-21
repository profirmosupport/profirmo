'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import Card from '@/components/common/Card';
import Select from '@/components/common/Select';
import EmptyState from '@/components/common/EmptyState';
import ProfessionalCard from '@/components/professionals/ProfessionalCard';
import ProfessionalFilters from '@/components/professionals/ProfessionalFilters';
import { useProfessionals } from '@/hooks/useProfessionals';
import { SORT_OPTIONS } from '@/utils/constants';

function ProfessionalsContent() {
  const searchParams = useSearchParams();
  const { professionals, loading, params, setParams } = useProfessionals();
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const search = searchParams.get('search');
    const city = searchParams.get('city');
    const category = searchParams.get('category');
    const seed = {};
    if (search) seed.search = search;
    if (city) seed.city = city;
    if (category) seed.professionType = category;
    if (Object.keys(seed).length > 0) {
      setParams((prev) => ({ ...prev, ...seed }));
    }
  }, [searchParams, setParams]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside>
          <ProfessionalFilters params={params} setParams={setParams} />
        </aside>

        <section>
          <Card padding={false} className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-slate-600">
              {loading ? (
                'Loading professionals…'
              ) : (
                <>
                  <span className="font-semibold text-slate-900">
                    {professionals.length}
                  </span>{' '}
                  professional{professionals.length === 1 ? '' : 's'} found
                </>
              )}
            </p>
            <div className="w-48">
              <Select
                name="sort"
                value={params.sort || 'rating'}
                onChange={(e) =>
                  setParams((prev) => ({ ...prev, sort: e.target.value }))
                }
                options={SORT_OPTIONS}
              />
            </div>
          </Card>

          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
                />
              ))}
            </div>
          ) : professionals.length === 0 ? (
            <EmptyState
              icon={<Search size={24} />}
              title="No professionals match your filters"
              description="Try widening your search or clearing some filters to see more results."
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {professionals.map((pro) => (
                <ProfessionalCard key={pro.id} professional={pro} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ProfessionalsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Find a professional
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Browse verified advocates, lawyers and tax consultants. Filter by
              expertise, city and rate to find the right expert for your matter.
            </p>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="mx-auto max-w-7xl px-4 py-12 text-sm text-slate-500 sm:px-6 lg:px-8">
              Loading…
            </div>
          }
        >
          <ProfessionalsContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
