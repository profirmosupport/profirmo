'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, ShieldCheck, Building2, Star } from 'lucide-react';
import Button from '@/components/common/Button';
import { CITIES } from '@/utils/constants';

/**
 * HeroSection — landing hero with headline, search bar and trust stats.
 */
export default function HeroSection() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('');

  function handleSearch(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) params.set('search', keyword.trim());
    if (city.trim()) params.set('city', city.trim());
    const query = params.toString();
    router.push(query ? `/professionals?${query}` : '/professionals');
  }

  const stats = [
    { icon: ShieldCheck, value: '500+', label: 'Verified professionals' },
    { icon: Building2, value: '50+', label: 'Cities covered' },
    { icon: Star, value: '4.8', label: 'Average rating' },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, white 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-blue-50 ring-1 ring-inset ring-white/25">
            <ShieldCheck size={14} />
            Verified legal &amp; tax experts you can trust
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Expert legal &amp; tax advice,
            <span className="block text-blue-200">one consultation away.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-blue-100 sm:text-lg">
            Find and consult verified advocates, lawyers, legal firms and tax
            consultants online. Compare profiles, book instantly and pay only
            for the minutes you use.
          </p>
        </div>

        {/* Search bar */}
        <form
          onSubmit={handleSearch}
          className="mx-auto mt-9 max-w-3xl rounded-2xl bg-white p-3 shadow-xl"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search by name, specialization or service"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div className="relative sm:w-52">
              <MapPin
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-300 py-2.5 pl-10 pr-8 text-sm text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">All cities</option>
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="lg" className="sm:w-auto">
              Search professionals
            </Button>
          </div>
        </form>

        {/* Trust stats */}
        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="flex items-center justify-center gap-3 rounded-xl bg-white/10 px-4 py-4 ring-1 ring-inset ring-white/15"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 text-blue-100">
                  <Icon size={20} />
                </span>
                <div className="text-left">
                  <p className="text-xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-blue-100">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
