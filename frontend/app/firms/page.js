'use client';

import { Building2 } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import Card from '@/components/common/Card';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import EmptyState from '@/components/common/EmptyState';
import FirmCard from '@/components/firms/FirmCard';
import { useFirms } from '@/hooks/useFirms';
import { CITIES, FIRM_TYPES } from '@/utils/constants';

const RATING_OPTIONS = [
  { value: '', label: 'Any rating' },
  { value: '3', label: '3.0 & up' },
  { value: '4', label: '4.0 & up' },
  { value: '4.5', label: '4.5 & up' },
];

const toOptions = (arr) => arr.map((v) => ({ value: v, label: v }));

export default function FirmsPage() {
  const { firms, loading, params, setParams } = useFirms();
  const update = (patch) => setParams((prev) => ({ ...prev, ...patch }));

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Browse firms
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Discover established legal and tax firms. Connect with a full team
              of professionals under one trusted practice.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Card className="mb-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Search"
                name="search"
                value={params.search || ''}
                onChange={(e) => update({ search: e.target.value })}
                placeholder="Firm name or keyword"
              />
              <Select
                label="City"
                name="city"
                value={params.city || ''}
                onChange={(e) => update({ city: e.target.value || undefined })}
                options={[
                  { value: '', label: 'All cities' },
                  ...toOptions(CITIES),
                ]}
              />
              <Select
                label="Firm type"
                name="firmType"
                value={params.firmType || ''}
                onChange={(e) =>
                  update({ firmType: e.target.value || undefined })
                }
                options={[
                  { value: '', label: 'All firm types' },
                  ...toOptions(FIRM_TYPES),
                ]}
              />
              <Select
                label="Minimum rating"
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
              'Loading firms…'
            ) : (
              <>
                <span className="font-semibold text-slate-900">
                  {firms.length}
                </span>{' '}
                firm{firms.length === 1 ? '' : 's'} found
              </>
            )}
          </p>

          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-56 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
                />
              ))}
            </div>
          ) : firms.length === 0 ? (
            <EmptyState
              icon={<Building2 size={24} />}
              title="No firms match your filters"
              description="Try adjusting your search or removing some filters to see more firms."
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {firms.map((firm) => (
                <FirmCard key={firm.id} firm={firm} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
