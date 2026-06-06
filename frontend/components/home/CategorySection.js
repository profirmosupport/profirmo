'use client';

import Link from 'next/link';
import {
  Heart,
  Users,
  Gavel,
  Scale,
  Home,
  Building2,
  Calculator,
  Receipt,
  FileText,
  Briefcase,
  Layers,
} from 'lucide-react';
import { useCategories } from '@/hooks/useAppSettings';
import { useLanguage } from '@/components/LanguageProvider';

const ICONS = {
  'divorce-lawyer': Heart,
  'family-lawyer': Users,
  'criminal-lawyer': Gavel,
  'civil-lawyer': Scale,
  'property-lawyer': Home,
  'corporate-lawyer': Building2,
  'tax-consultant': Calculator,
  'gst-consultant': Receipt,
  'income-tax-consultant': FileText,
  'company-registration-consultant': Briefcase,
};

// Hard cap on the homepage grid so a generous admin curation doesn't
// blow the section into a 30-card wall. Featured sub-categories beyond
// this cap stay accessible via the full search/filter page.
const HOME_GRID_CAP = 10;

export default function CategorySection() {
  const { t } = useLanguage();
  const { categories: apiCategories } = useCategories();

  // Flatten the admin-managed taxonomy and keep only TOP-LEVEL
  // sub-categories an admin has flagged as "Featured". Deeper tiers
  // (sub-sub-categories, practice areas) are search-only refinements,
  // not homepage landing entries, so they're excluded even if someone
  // ticks the Featured flag deeper in the tree.
  const collected = [];
  for (const cat of apiCategories) {
    const isTax = String(cat.slug || '').toLowerCase() === 'tax';
    for (const sub of cat.subCategories || []) {
      if (!sub.featured) continue;
      if (sub.parentSubCategoryId) continue;
      const slug = String(sub.name || '')
        .toLowerCase()
        .replace(/\s+/g, '-');
      collected.push({
        id: sub.id,
        name: sub.name,
        slug,
        sortOrder: Number.isFinite(Number(sub.sortOrder))
          ? Number(sub.sortOrder)
          : 0,
        type: isTax ? 'tax' : 'legal',
      });
    }
  }
  // Sort by sortOrder then name so admins can hand-arrange the grid.
  collected.sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      String(a.name).localeCompare(String(b.name), undefined, {
        sensitivity: 'base',
      })
  );
  const categories = collected.slice(0, HOME_GRID_CAP);

  // If no sub-category is featured yet, hide the section entirely so the
  // home page doesn't render an empty grid.
  if (categories.length === 0) return null;

  return (
    <section className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 ring-1 ring-inset ring-indigo-200">
            <Layers className="h-3.5 w-3.5" />
            {t('category.eyebrow')}
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t('category.heading')}
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            {t('category.subtext')}
          </p>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((category) => {
            const Icon = ICONS[category.slug] || Scale;
            const isLegal = category.type === 'legal';
            return (
              <Link
                key={category.id}
                href={`/search?category=${encodeURIComponent(category.name)}`}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-glow-cyan"
              >
                <span
                  className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-teal-500/0 blur-2xl transition-all duration-300 group-hover:bg-teal-500/20"
                  aria-hidden="true"
                />
                <span
                  className={`grid h-12 w-12 place-items-center rounded-xl transition group-hover:scale-105 ${
                    isLegal
                      ? 'bg-indigo-50 text-indigo-600 group-hover:bg-gradient-to-br group-hover:from-indigo-600 group-hover:to-violet-600 group-hover:text-white'
                      : 'bg-violet-50 text-violet-600 group-hover:bg-gradient-to-br group-hover:from-violet-600 group-hover:to-blue-600 group-hover:text-white'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-slate-900 transition group-hover:text-indigo-600">
                  {category.name}
                </h3>
                <span
                  className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    isLegal
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'bg-violet-50 text-violet-600'
                  }`}
                >
                  {isLegal ? t('category.tagLegal') : t('category.tagTax')}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
