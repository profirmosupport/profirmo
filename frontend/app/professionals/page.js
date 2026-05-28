'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import Card from '@/components/common/Card';
import Select from '@/components/common/Select';
import EmptyState from '@/components/common/EmptyState';
import ProfessionalCard from '@/components/professionals/ProfessionalCard';
import ProfessionalFilters from '@/components/professionals/ProfessionalFilters';
import { useProfessionals } from '@/hooks/useProfessionals';
import { useLocations } from '@/hooks/useLocations';
import { useLanguage } from '@/components/LanguageProvider';

function ProfessionalsContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const { items, meta, loading, error, params, setParams } = useProfessionals();
  const { flatCities, loading: locLoading } = useLocations();
  const seeded = useRef(false);

  const sortOptions = [
    { value: 'rating', label: t('profList.sortRating') },
    { value: 'experience', label: t('profList.sortExperience') },
    { value: 'fee', label: t('profList.sortPriceLow') },
  ];

  // Seed filters from the URL query (?search=&city=&subCategoryId=) once on
  // mount. `category` is kept as a back-compat alias for older inbound links —
  // values starting with `subcat-` are treated as ids, everything else is a
  // legacy free-text professionType.
  //
  // We wait for the locations tree to load so that a city name in the URL
  // (?city=Mumbai, used by footer SEO links) can be resolved to its city id
  // — that's what the side-filter Combobox needs to render the chosen value.
  useEffect(() => {
    if (seeded.current) return;
    if (locLoading) return;
    seeded.current = true;
    const search = searchParams.get('search');
    const cityParam = searchParams.get('city');
    const subCategoryId = searchParams.get('subCategoryId');
    const category = searchParams.get('category');
    const seed = {};
    if (search) seed.search = search;
    if (cityParam) {
      if (cityParam.startsWith('city-')) {
        seed.city = cityParam;
      } else {
        const match = flatCities.find(
          (c) => c.name.toLowerCase() === cityParam.toLowerCase()
        );
        seed.city = match ? match.id : cityParam;
      }
    }
    if (subCategoryId) {
      seed.subCategoryId = subCategoryId;
    } else if (category) {
      if (String(category).startsWith('subcat-')) {
        seed.subCategoryId = category;
      } else {
        seed.professionType = category;
      }
    }
    if (Object.keys(seed).length > 0) {
      setParams((prev) => ({ ...prev, ...seed }));
    }
  }, [searchParams, setParams, locLoading, flatCities]);

  const totalCount = meta && Number.isFinite(meta.total) ? meta.total : items.length;
  const currentPage = meta && meta.page ? meta.page : 1;
  const totalPages = meta && meta.totalPages ? meta.totalPages : 1;

  const goToPage = (page) => {
    setParams((prev) => ({ ...prev, page }));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside>
          <ProfessionalFilters params={params} setParams={setParams} />
        </aside>

        <section>
          <Card
            padding={false}
            className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <p className="text-sm text-slate-600">
              {loading ? (
                t('profList.loading')
              ) : (
                <>
                  <span className="font-semibold text-slate-900">
                    {totalCount}
                  </span>{' '}
                  {totalCount === 1
                    ? t('profList.countOne')
                    : t('profList.countOther')}
                </>
              )}
            </p>
            <div className="w-48">
              <Select
                name="sort"
                value={params.sort || 'rating'}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    sort: e.target.value,
                    page: 1,
                  }))
                }
                options={sortOptions}
              />
            </div>
          </Card>

          {error && !loading && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Search size={24} />}
              title={t('profList.emptyTitle')}
              description={t('profList.emptyDesc')}
            />
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((pro) => (
                  <ProfessionalCard key={pro.id} professional={pro} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-teal-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft size={16} />
                    Prev
                  </button>
                  <span className="px-3 text-sm text-slate-600">
                    Page{' '}
                    <span className="font-semibold text-slate-900">
                      {currentPage}
                    </span>{' '}
                    of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-teal-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ProfessionalsPage() {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {t('profList.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              {t('profList.subtitle')}
            </p>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="mx-auto max-w-7xl px-4 py-12 text-sm text-slate-500 sm:px-6 lg:px-8">
              {t('profList.loadingShort')}
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
