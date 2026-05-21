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
  ArrowRight,
} from 'lucide-react';
import { categories } from '@/data/mockData';

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

/**
 * CategorySection — grid of the 10 consultation categories.
 */
export default function CategorySection() {
  return (
    <section className="bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Browse by category
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Whatever your legal or tax need, find the right specialist in
            minutes.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((category) => {
            const Icon = ICONS[category.slug] || Scale;
            const isLegal = category.type === 'legal';
            return (
              <Link
                key={category.id}
                href={`/professionals?category=${encodeURIComponent(
                  category.name
                )}`}
                className="group flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-lg ${
                    isLegal
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  <Icon size={22} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 group-hover:text-blue-700">
                    {category.name}
                  </h3>
                  <span
                    className={`mt-1 inline-block text-xs font-medium ${
                      isLegal ? 'text-blue-600' : 'text-emerald-600'
                    }`}
                  >
                    {isLegal ? 'Legal' : 'Tax'}
                  </span>
                </div>
                <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors group-hover:text-blue-600">
                  View experts
                  <ArrowRight
                    size={13}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
