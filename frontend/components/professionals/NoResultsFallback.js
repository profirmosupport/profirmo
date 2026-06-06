'use client';

// NoResultsFallback — drop-in empty-state shown by the public listing
// pages (/professionals, /search, /professionals/city/[slug]) when
// their primary query returns zero hits. Instead of leaving the page
// looking dead, we surface a friendly note + 5 RANDOM admin-featured
// professionals so the visitor still has someone to click through to.
//
// "Random" picks happen client-side from the cached featured list,
// so a refresh shuffles the suggestions. Featured professionals are
// usually willing to take PAN-India consultations — that's the
// editorial copy the message references.

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import ProfessionalCard from '@/components/professionals/ProfessionalCard';
import { getAll as listProfessionals } from '@/services/professionalService';

const RANDOM_PICK = 5;

// Pull a generous pool of featured rows once and reuse it across
// every render of the fallback within the session. Avoids spamming
// the listing API as the visitor toggles filters.
let pool = null;
let poolPromise = null;

async function loadPool() {
  if (pool) return pool;
  if (poolPromise) return poolPromise;
  poolPromise = listProfessionals({
    featured: true,
    sort: 'featured',
    limit: 24,
  })
    .then((res) => {
      pool = Array.isArray(res && res.data) ? res.data : [];
      return pool;
    })
    .catch(() => {
      pool = [];
      return pool;
    });
  return poolPromise;
}

function pickRandom(arr, n) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  if (arr.length <= n) return arr.slice();
  const copy = arr.slice();
  // Fisher-Yates shuffle, truncate to n.
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export default function NoResultsFallback() {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadPool().then((rows) => {
      if (!active) return;
      setPicks(pickRandom(rows, RANDOM_PICK));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Search size={22} />
        </span>
        <h2 className="mt-4 text-xl font-bold text-slate-900">
          No results found
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
          Try a different keyword or adjust your filters to broaden the
          search — or browse some of our verified professionals who
          consult PAN India.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      ) : picks.length === 0 ? null : (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
              PAN India consultations
            </span>
            <span className="text-xs text-slate-500">
              Verified professionals you can talk to right now
            </span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {picks.map((pro) => (
              <ProfessionalCard key={pro.id} professional={pro} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
