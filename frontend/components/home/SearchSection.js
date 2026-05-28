'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Briefcase, MapPin, Sparkles } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import Combobox from '@/components/common/Combobox';
import { useSubCategoriesFlat } from '@/hooks/useAppSettings';
import { useLocations } from '@/hooks/useLocations';

export default function SearchSection() {
  const router = useRouter();
  const { t } = useLanguage();
  const { subCategories } = useSubCategoriesFlat();
  const { flatCities } = useLocations();
  const [keyword, setKeyword] = useState('');
  const [profession, setProfession] = useState('');
  const [city, setCity] = useState('');

  // Up to five active sub-categories make the "popular" chip row.
  const popular = subCategories.slice(0, 5);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) params.set('search', keyword.trim());
    // `profession` holds a sub-category id; the listing page accepts it via
    // `subCategoryId`. `category` is kept as a back-compat alias.
    if (profession) {
      params.set('subCategoryId', profession);
      params.set('category', profession);
    }
    if (city) params.set('city', city);
    const qs = params.toString();
    router.push(qs ? `/professionals?${qs}` : '/professionals');
  };

  return (
    <section className="relative bg-white pb-10 pt-16 sm:pb-12 sm:pt-20">
      <div
        className="pointer-events-none absolute -top-10 left-1/2 h-48 w-[36rem] max-w-full -translate-x-1/2 rounded-full bg-orange-300/25 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700">
            <Search className="h-3.5 w-3.5" />
            {t('search.eyebrow')}
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t('search.headingLead')}{' '}
            <span className="text-gradient">{t('search.headingHighlight')}</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-600">
            {t('search.subtext')}
          </p>
        </div>

        {/* Search panel */}
        <form
          onSubmit={handleSearch}
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-3 shadow-card transition-all duration-300 hover:border-teal-300 hover:shadow-glow-cyan sm:p-4"
        >
          <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
            {/* Keyword */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={t('search.keywordPlaceholder')}
                aria-label={t('search.keywordAria')}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
              />
            </div>

            {/* Profession — admin-managed sub-categories, searchable */}
            <Combobox
              name="profession"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              placeholder={t('search.allProfessions')}
              leftIcon={<Briefcase size={16} />}
              options={subCategories.map((s) => ({
                value: s.id,
                label: `${s.categoryName} — ${s.name}`,
              }))}
            />

            {/* City — admin-managed list, searchable */}
            <Combobox
              name="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t('search.allCities')}
              leftIcon={<MapPin size={16} />}
              options={flatCities.map((c) => ({
                value: c.id,
                label: c.label,
              }))}
            />

            {/* Submit */}
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-6 text-sm font-semibold text-white shadow-glow-sm transition hover:-translate-y-0.5 hover:shadow-glow"
            >
              <Search className="h-4 w-4" />
              {t('search.button')}
            </button>
          </div>
        </form>

        {/* Popular searches */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-green-500" />
            {t('search.popular')}
          </span>
          {popular.map((s) => (
            <Link
              key={s.id}
              href={`/professionals?subCategoryId=${encodeURIComponent(s.id)}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
            >
              {s.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
