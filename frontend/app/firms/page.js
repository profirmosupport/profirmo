'use client';

import { Building2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import Card from '@/components/common/Card';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Combobox from '@/components/common/Combobox';
import EmptyState from '@/components/common/EmptyState';
import FirmCard from '@/components/firms/FirmCard';
import { useFirms } from '@/hooks/useFirms';
import { useLanguage } from '@/components/LanguageProvider';
import { FIRM_TYPES } from '@/utils/constants';
import { useLocations } from '@/hooks/useLocations';

const toOptions = (arr) => arr.map((v) => ({ value: v, label: v }));

export default function FirmsPage() {
  const { t } = useLanguage();
  const { items, meta, loading, error, params, setParams } = useFirms();
  const { flatCities } = useLocations();
  const update = (patch) =>
    setParams((prev) => ({ ...prev, ...patch, page: 1 }));

  const RATING_OPTIONS = [
    { value: '', label: t('firmList.anyRating') },
    { value: '3', label: t('firmList.rating3') },
    { value: '4', label: t('firmList.rating4') },
    { value: '4.5', label: t('firmList.rating45') },
  ];

  const totalCount =
    meta && Number.isFinite(meta.total) ? meta.total : items.length;
  const currentPage = meta && meta.page ? meta.page : 1;
  const totalPages = meta && meta.totalPages ? meta.totalPages : 1;

  const goToPage = (page) => {
    setParams((prev) => ({ ...prev, page }));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {t('firmList.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              {t('firmList.subtitle')}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Card className="mb-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label={t('firmList.search')}
                name="search"
                value={params.search || ''}
                onChange={(e) => update({ search: e.target.value })}
                placeholder={t('firmList.searchPlaceholder')}
              />
              <Combobox
                label={t('firmList.city')}
                name="city"
                value={params.city || ''}
                onChange={(e) => update({ city: e.target.value || undefined })}
                placeholder={t('firmList.allCities')}
                options={flatCities.map((c) => ({
                  value: c.id,
                  label: c.label,
                }))}
              />
              <Select
                label={t('firmList.firmType')}
                name="firmType"
                value={params.firmType || ''}
                onChange={(e) =>
                  update({ firmType: e.target.value || undefined })
                }
                options={[
                  { value: '', label: t('firmList.allFirmTypes') },
                  ...toOptions(FIRM_TYPES),
                ]}
              />
              <Select
                label={t('firmList.minRating')}
                name="minRating"
                value={params.minRating || ''}
                onChange={(e) =>
                  update({ minRating: e.target.value || undefined })
                }
                options={RATING_OPTIONS}
              />
            </div>
          </Card>

          <p className="mb-4 text-sm text-slate-600">
            {loading ? (
              t('firmList.loading')
            ) : (
              <>
                <span className="font-semibold text-slate-900">
                  {totalCount}
                </span>{' '}
                {totalCount === 1
                  ? t('firmList.countOne')
                  : t('firmList.countOther')}
              </>
            )}
          </p>

          {error && !loading && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-56 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Building2 size={24} />}
              title={t('firmList.emptyTitle')}
              description={t('firmList.emptyDesc')}
            />
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((firm) => (
                  <FirmCard key={firm.id} firm={firm} />
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
        </div>
      </main>
      <Footer />
    </div>
  );
}
