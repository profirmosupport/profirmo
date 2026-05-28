'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Compass,
  ArrowRight,
  Users,
  Building2,
  Home as HomeIcon,
} from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import Button from '@/components/common/Button';
import { useLanguage } from '@/components/LanguageProvider';

// Popular jump-off links shown under the search box. Kept hard-coded so the
// 404 page never depends on data fetches — it must render even when APIs fail.
const POPULAR = [
  { href: '/professionals', label: 'Lawyers' },
  { href: '/professionals?category=Tax+Consultant', label: 'Tax consultants' },
  { href: '/professionals?city=Mumbai', label: 'In Mumbai' },
  { href: '/professionals?city=Delhi', label: 'In Delhi' },
  { href: '/professionals?city=Bangalore', label: 'In Bangalore' },
  { href: '/firms', label: 'Law firms' },
];

export default function NotFound() {
  const { t } = useLanguage();
  const router = useRouter();
  const [q, setQ] = useState('');

  const onSearch = (e) => {
    e.preventDefault();
    const term = q.trim();
    router.push(
      term ? `/professionals?search=${encodeURIComponent(term)}` : '/professionals'
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-teal-600 text-white shadow-glow-sm">
            <Compass className="h-10 w-10" aria-hidden="true" />
          </div>

          <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-amber-600">
            {t('notFound.code')}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t('notFound.title')}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
            {t('notFound.desc')}
          </p>

          <form
            onSubmit={onSearch}
            className="mx-auto mt-8 flex w-full max-w-lg items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-card focus-within:border-teal-400"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('notFound.searchPlaceholder')}
                aria-label={t('notFound.searchPlaceholder')}
                className="w-full rounded-xl bg-transparent py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:shadow-glow"
            >
              {t('notFound.searchCta')}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button href="/" variant="primary" size="md">
              <HomeIcon className="mr-1.5 h-4 w-4" />
              {t('notFound.backHome')}
            </Button>
            <Button href="/professionals" variant="outline" size="md">
              <Users className="mr-1.5 h-4 w-4" />
              {t('notFound.findPros')}
            </Button>
            <Button href="/firms" variant="outline" size="md">
              <Building2 className="mr-1.5 h-4 w-4" />
              {t('notFound.browseFirms')}
            </Button>
          </div>

          <div className="mt-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              {t('notFound.popular')}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {POPULAR.map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
                >
                  {p.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
