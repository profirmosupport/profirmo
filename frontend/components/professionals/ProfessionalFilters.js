'use client';

import { SlidersHorizontal } from 'lucide-react';
import Card from '@/components/common/Card';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import {
  CITIES,
  PROFESSION_TYPES,
  SPECIALIZATIONS,
  LANGUAGES,
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

/**
 * ProfessionalFilters — sticky sidebar filter panel.
 *
 * Props: { params, setParams }
 */
export default function ProfessionalFilters({ params = {}, setParams }) {
  const update = (patch) => setParams((prev) => ({ ...prev, ...patch }));

  const handleExperience = (value) => {
    const range = EXPERIENCE_RANGES.find((r) => r.value === value);
    update({
      experience: value,
      minExperience: range && range.value !== 'any' ? range.min : undefined,
      maxExperience:
        range && range.value !== 'any' && Number.isFinite(range.max)
          ? range.max
          : undefined,
    });
  };

  const handleRate = (value) => {
    const range = RATE_RANGES.find((r) => r.value === value);
    update({
      rateRange: value,
      minRate: range && range.value !== 'any' ? range.min : undefined,
      maxRate:
        range && range.value !== 'any' && Number.isFinite(range.max)
          ? range.max
          : undefined,
    });
  };

  const clearAll = () => {
    setParams({ sort: params.sort });
  };

  return (
    <Card className="lg:sticky lg:top-20">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={18} className="text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
        </div>
        <button
          type="button"
          onClick={clearAll}
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          Clear all
        </button>
      </div>

      <div className="space-y-4">
        <Input
          label="Search"
          name="search"
          value={params.search || ''}
          onChange={(e) => update({ search: e.target.value })}
          placeholder="Name or keyword"
        />

        <Select
          label="City"
          name="city"
          value={params.city || ''}
          onChange={(e) => update({ city: e.target.value || undefined })}
          options={[{ value: '', label: 'All cities' }, ...toOptions(CITIES)]}
        />

        <Select
          label="Profession"
          name="professionType"
          value={params.professionType || ''}
          onChange={(e) =>
            update({ professionType: e.target.value || undefined })
          }
          options={[
            { value: '', label: 'All professions' },
            ...toOptions(PROFESSION_TYPES),
          ]}
        />

        <Select
          label="Specialization"
          name="specialization"
          value={params.specialization || ''}
          onChange={(e) =>
            update({ specialization: e.target.value || undefined })
          }
          options={[
            { value: '', label: 'All specializations' },
            ...toOptions(SPECIALIZATIONS),
          ]}
        />

        <Select
          label="Experience"
          name="experience"
          value={params.experience || 'any'}
          onChange={(e) => handleExperience(e.target.value)}
          options={EXPERIENCE_RANGES.map((r) => ({
            value: r.value,
            label: r.label,
          }))}
        />

        <Select
          label="Rate per minute"
          name="rateRange"
          value={params.rateRange || 'any'}
          onChange={(e) => handleRate(e.target.value)}
          options={RATE_RANGES.map((r) => ({ value: r.value, label: r.label }))}
        />

        <Select
          label="Minimum rating"
          name="minRating"
          value={params.minRating || ''}
          onChange={(e) => update({ minRating: e.target.value || undefined })}
          options={RATING_OPTIONS}
        />

        <Select
          label="Language"
          name="language"
          value={params.language || ''}
          onChange={(e) => update({ language: e.target.value || undefined })}
          options={[
            { value: '', label: 'Any language' },
            ...toOptions(LANGUAGES),
          ]}
        />

        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5">
          <input
            type="checkbox"
            checked={params.availableNow === true}
            onChange={(e) =>
              update({ availableNow: e.target.checked ? true : undefined })
            }
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-slate-700">
            Available now only
          </span>
        </label>
      </div>
    </Card>
  );
}
