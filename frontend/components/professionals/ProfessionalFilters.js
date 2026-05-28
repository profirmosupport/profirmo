'use client';

import { useState } from 'react';
import { SlidersHorizontal, Filter, ChevronDown } from 'lucide-react';
import Card from '@/components/common/Card';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Combobox from '@/components/common/Combobox';
import { useLanguage } from '@/components/LanguageProvider';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { useSubCategoriesFlat } from '@/hooks/useAppSettings';
import { useLocations } from '@/hooks/useLocations';
import { EXPERIENCE_RANGES, RATE_RANGES } from '@/utils/constants';

const toOptions = (arr) => arr.map((v) => ({ value: v, label: v }));

// Keys that count towards the "active filter" badge — `sort` is intentionally
// excluded since it is not a filter.
const FILTER_KEYS = [
  'search',
  'city',
  'professionType',
  'professionalType',
  'subCategoryId',
  'experience',
  'rateRange',
  'minRating',
  'language',
  'availableNow',
];

/** Count how many filters are currently set to a non-empty / non-default value. */
function countActive(params = {}) {
  return FILTER_KEYS.reduce((n, key) => {
    const value = params[key];
    if (value === undefined || value === null || value === '') return n;
    if (value === false) return n;
    if ((key === 'experience' || key === 'rateRange') && value === 'any') {
      return n;
    }
    return n + 1;
  }, 0);
}

/**
 * ProfessionalFilters — filter panel. The City / Profession / Specialization /
 * Language dropdowns are populated from the live database via useFilterOptions,
 * so every option matches real data and filtering returns accurate results.
 *
 * Desktop (lg and up): the panel is always visible and expanded.
 * Mobile/tablet (below lg): collapsed by default behind a "Filters" toggle.
 *
 * Props: { params, setParams, onApplied }
 */
export default function ProfessionalFilters({
  params = {},
  setParams,
  onApplied,
}) {
  const { t } = useLanguage();
  // `options` keeps language list from live data. Cities and categories now
  // come from the admin-managed lists so they stay in sync with the panel.
  const options = useFilterOptions();
  const { flatCities } = useLocations();
  const { subCategories } = useSubCategoriesFlat();
  // Mobile-only open/closed state. Desktop ignores this (panel is lg:block).
  const [mobileOpen, setMobileOpen] = useState(false);

  const update = (patch) => setParams((prev) => ({ ...prev, ...patch }));

  const RATING_OPTIONS = [
    { value: '', label: t('profCmp.anyRating') },
    { value: '3', label: t('profCmp.rating3') },
    { value: '4', label: t('profCmp.rating4') },
    { value: '4.5', label: t('profCmp.rating45') },
  ];

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
      minFee: range && range.value !== 'any' ? range.min : undefined,
      maxFee:
        range && range.value !== 'any' && Number.isFinite(range.max)
          ? range.max
          : undefined,
    });
  };

  const clearAll = () => {
    setParams({ sort: params.sort });
  };

  const activeCount = countActive(params);

  return (
    <div className="lg:sticky lg:top-20">
      {/* Mobile-only toggle button — hidden on lg and up. */}
      <button
        type="button"
        onClick={() => setMobileOpen((o) => !o)}
        aria-expanded={mobileOpen}
        className="mb-3 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-card transition hover:border-teal-300 lg:hidden"
      >
        <span className="flex items-center gap-2">
          <Filter size={16} className="text-slate-500" />
          {t('profCmp.filters')}
          {activeCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
              {activeCount}
            </span>
          )}
        </span>
        <ChevronDown
          size={18}
          className={`text-slate-400 transition-transform duration-300 ${
            mobileOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Collapsible wrapper — below lg driven by `mobileOpen`; lg+ always open. */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out lg:!max-h-none lg:!opacity-100 ${
          mobileOpen
            ? 'max-h-[1600px] opacity-100'
            : 'max-h-0 opacity-0 lg:max-h-none lg:opacity-100'
        }`}
      >
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">
                {t('profCmp.filters')}
              </h2>
            </div>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              {t('profCmp.clearAll')}
            </button>
          </div>

          <div className="space-y-4">
            <Input
              label={t('profCmp.search')}
              name="search"
              value={params.search || ''}
              onChange={(e) => update({ search: e.target.value })}
              placeholder={t('profCmp.searchPlaceholder')}
            />

            <Combobox
              label={t('profCmp.city')}
              name="city"
              value={params.city || ''}
              onChange={(e) => update({ city: e.target.value || undefined })}
              placeholder={t('profCmp.allCities')}
              options={flatCities.map((c) => ({
                value: c.id,
                label: c.label,
              }))}
            />

            <Combobox
              label={t('profCmp.profession')}
              name="subCategoryId"
              value={params.subCategoryId || ''}
              onChange={(e) =>
                update({
                  subCategoryId: e.target.value || undefined,
                  // Clear the legacy professionType filter so the two cannot
                  // fight each other in the listing service.
                  professionType: undefined,
                })
              }
              placeholder={t('profCmp.allProfessions')}
              options={subCategories.map((s) => ({
                value: s.id,
                label: `${s.categoryName} — ${s.name}`,
              }))}
            />

            {/* Specialization filter was removed — the new sub-category
                taxonomy above replaces it. */}

            <Select
              label={t('profCmp.experience')}
              name="experience"
              value={params.experience || 'any'}
              onChange={(e) => handleExperience(e.target.value)}
              options={EXPERIENCE_RANGES.map((r) => ({
                value: r.value,
                label: r.label,
              }))}
            />

            <Select
              label={t('profCmp.ratePerMinute')}
              name="rateRange"
              value={params.rateRange || 'any'}
              onChange={(e) => handleRate(e.target.value)}
              options={RATE_RANGES.map((r) => ({
                value: r.value,
                label: r.label,
              }))}
            />

            <Select
              label={t('profCmp.minRating')}
              name="minRating"
              value={params.minRating || ''}
              onChange={(e) =>
                update({ minRating: e.target.value || undefined })
              }
              options={RATING_OPTIONS}
            />

            <Select
              label={t('profCmp.language')}
              name="language"
              value={params.language || ''}
              onChange={(e) =>
                update({ language: e.target.value || undefined })
              }
              options={[
                { value: '', label: t('profCmp.anyLanguage') },
                ...toOptions(options.languages),
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
                {t('profCmp.availableNowOnly')}
              </span>
            </label>

            {/* Mobile-only apply button — closes the panel. Hidden on lg+. */}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                if (typeof onApplied === 'function') onApplied();
              }}
              className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600 lg:hidden"
            >
              Apply filters
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
