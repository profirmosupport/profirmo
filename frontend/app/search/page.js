'use client';

import { useMemo, useState } from 'react';
import { Search, Users, Building2 } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import Card from '@/components/common/Card';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import EmptyState from '@/components/common/EmptyState';
import ProfessionalCard from '@/components/professionals/ProfessionalCard';
import FirmCard from '@/components/firms/FirmCard';
import { professionals, firms } from '@/data/mockData';
import {
  PROFESSION_TYPES,
  CITIES,
  EXPERIENCE_RANGES,
  RATE_RANGES,
} from '@/utils/constants';

const RATING_OPTIONS = [
  { value: '', label: 'Any rating' },
  { value: '3', label: '3.0 & up' },
  { value: '4', label: '4.0 & up' },
  { value: '4.5', label: '4.5 & up' },
];

const toOptions = (arr) => arr.map((v) => ({ value: v, label: v }));

const INITIAL_FILTERS = {
  keyword: '',
  category: '',
  location: '',
  experience: 'any',
  rating: '',
  availableNow: false,
  rateRange: 'any',
};

export default function SearchPage() {
  const [mode, setMode] = useState('individual');
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const update = (patch) => setFilters((prev) => ({ ...prev, ...patch }));
  const resetFilters = () => setFilters(INITIAL_FILTERS);

  const filteredProfessionals = useMemo(() => {
    const q = filters.keyword.trim().toLowerCase();
    const expRange = EXPERIENCE_RANGES.find((r) => r.value === filters.experience);
    const rateRange = RATE_RANGES.find((r) => r.value === filters.rateRange);
    const minRating = filters.rating ? Number(filters.rating) : 0;

    return professionals.filter((p) => {
      if (
        q &&
        ![p.name, p.professionType, p.specialization, p.city, p.bio]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(q))
      ) {
        return false;
      }
      if (filters.category && p.professionType !== filters.category)
        return false;
      if (filters.location && p.city !== filters.location) return false;
      if (
        expRange &&
        expRange.value !== 'any' &&
        (p.experience < expRange.min || p.experience > expRange.max)
      ) {
        return false;
      }
      if (
        rateRange &&
        rateRange.value !== 'any' &&
        (p.perMinuteRate < rateRange.min || p.perMinuteRate > rateRange.max)
      ) {
        return false;
      }
      if (p.rating < minRating) return false;
      if (filters.availableNow && !p.availableNow) return false;
      return true;
    });
  }, [filters]);

  const filteredFirms = useMemo(() => {
    const q = filters.keyword.trim().toLowerCase();
    const minRating = filters.rating ? Number(filters.rating) : 0;

    return firms.filter((f) => {
      if (
        q &&
        ![f.name, f.firmType, f.city, f.description]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q))
      ) {
        return false;
      }
      if (filters.location && f.city !== filters.location) return false;
      if (f.rating < minRating) return false;
      return true;
    });
  }, [filters]);

  const results = mode === 'individual' ? filteredProfessionals : filteredFirms;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Advanced search
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Search across individual professionals and firms. Combine filters
              to pinpoint exactly the expertise you need.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Card className="mb-6">
            {/* Mode toggle */}
            <div className="mb-5 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setMode('individual')}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  mode === 'individual'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Users size={16} />
                Individuals
              </button>
              <button
                type="button"
                onClick={() => setMode('firm')}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  mode === 'firm'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Building2 size={16} />
                Firms
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                label="Keyword"
                name="keyword"
                value={filters.keyword}
                onChange={(e) => update({ keyword: e.target.value })}
                placeholder="Name, expertise or keyword"
              />
              <Select
                label="Category"
                name="category"
                value={filters.category}
                onChange={(e) => update({ category: e.target.value })}
                options={[
                  { value: '', label: 'All categories' },
                  ...toOptions(PROFESSION_TYPES),
                ]}
              />
              <Select
                label="Location"
                name="location"
                value={filters.location}
                onChange={(e) => update({ location: e.target.value })}
                options={[
                  { value: '', label: 'All cities' },
                  ...toOptions(CITIES),
                ]}
              />
              <Select
                label="Experience"
                name="experience"
                value={filters.experience}
                onChange={(e) => update({ experience: e.target.value })}
                options={EXPERIENCE_RANGES.map((r) => ({
                  value: r.value,
                  label: r.label,
                }))}
              />
              <Select
                label="Minimum rating"
                name="rating"
                value={filters.rating}
                onChange={(e) => update({ rating: e.target.value })}
                options={RATING_OPTIONS}
              />
              <Select
                label="Price range"
                name="rateRange"
                value={filters.rateRange}
                onChange={(e) => update({ rateRange: e.target.value })}
                options={RATE_RANGES.map((r) => ({
                  value: r.value,
                  label: r.label,
                }))}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 ${
                  mode === 'firm' ? 'opacity-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={filters.availableNow}
                  disabled={mode === 'firm'}
                  onChange={(e) => update({ availableNow: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">
                  Available now only
                </span>
              </label>
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Reset filters
              </button>
            </div>
          </Card>

          <p className="mb-4 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">
              {results.length}
            </span>{' '}
            {mode === 'individual'
              ? `professional${results.length === 1 ? '' : 's'}`
              : `firm${results.length === 1 ? '' : 's'}`}{' '}
            found
          </p>

          {results.length === 0 ? (
            <EmptyState
              icon={<Search size={24} />}
              title="No results found"
              description="Try a different keyword or adjust your filters to broaden the search."
            />
          ) : mode === 'individual' ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProfessionals.map((pro) => (
                <ProfessionalCard key={pro.id} professional={pro} />
              ))}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredFirms.map((firm) => (
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
