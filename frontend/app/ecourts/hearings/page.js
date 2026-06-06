'use client';

// /ecourts/hearings — daily causelist lookup. Drives the partner
// /causelist/search endpoint. Three usage paths in one screen:
//
//   1. Logged-in user with saved E-Courts cases → one-click "My hearings"
//      filter that ORs together the unique advocate / litigant names
//      derived from their saved Case rows.
//   2. Free-text filter by judge / advocate / litigant + a date range.
//   3. Optional state narrowing (free /court-structure/states endpoint).
//
// Causelist hits are credit-billed upstream, so we lazy-fire: nothing
// runs until the user clicks Search.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Filter,
  Gavel,
  Loader2,
  MapPin,
  Scale,
  Search,
  Sparkles,
  User,
  Users2,
} from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import EmptyState from '@/components/common/EmptyState';
import { useAuth } from '@/components/AuthProvider';
import caseService from '@/services/caseService';
import {
  listStates,
  searchCauselist,
} from '@/services/ecourtsService';

const PAGE_SIZE = 20;

function isoToday(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      weekday: 'short',
    });
  } catch {
    return String(iso);
  }
}

function EntryRow({ entry }) {
  const cnr = entry.cnr || entry.cnrNumber;
  return (
    <div className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-amber-300 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          {cnr ? (
            <Link
              href={`/ecourts/${encodeURIComponent(cnr)}`}
              className="font-mono text-[11px] uppercase tracking-widest text-slate-500 hover:text-amber-700"
            >
              {cnr}
            </Link>
          ) : null}
          {entry.bench ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {entry.bench}
            </span>
          ) : null}
          {entry.listType ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
              {entry.listType}
            </span>
          ) : null}
        </div>
        <h3 className="mt-1 text-sm font-semibold text-slate-900">
          {entry.caseTitle ||
            entry.title ||
            [entry.petitioner, entry.respondent].filter(Boolean).join(' vs ') ||
            'Untitled hearing'}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Calendar size={11} className="text-amber-500" />
            {fmtDate(entry.hearingDate || entry.date)}
            {entry.serialNo ? ` · #${entry.serialNo}` : ''}
          </span>
          {entry.judge ? (
            <span className="inline-flex items-center gap-1">
              <Gavel size={11} className="text-slate-400" />
              {entry.judge}
            </span>
          ) : null}
          {entry.courtNo ? (
            <span className="inline-flex items-center gap-1">
              <MapPin size={11} className="text-slate-400" />
              Court {entry.courtNo}
            </span>
          ) : null}
        </div>
        {entry.purpose ? (
          <p className="mt-1 text-xs text-slate-600">{entry.purpose}</p>
        ) : null}
      </div>
      {cnr ? (
        <Link
          href={`/ecourts/${encodeURIComponent(cnr)}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
        >
          Open case
          <ArrowRight size={11} />
        </Link>
      ) : null}
    </div>
  );
}

export default function HearingsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [states, setStates] = useState([]);
  const [myCnrs, setMyCnrs] = useState([]);

  const [filters, setFilters] = useState({
    advocate: '',
    judge: '',
    litigant: '',
    state: '',
    startDate: isoToday(0),
    endDate: isoToday(7),
  });

  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState({ totalHits: 0, totalPages: 0, page: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchedOnce, setSearchedOnce] = useState(false);

  useEffect(() => {
    let active = true;
    listStates()
      .then((rows) => active && setStates(rows))
      .catch(() => active && setStates([]));
    return () => {
      active = false;
    };
  }, []);

  // Pull the user's saved E-Courts cases so we can offer a one-click
  // "My hearings" shortcut. Falls open silently — failure here only
  // disables the button, doesn't block manual search.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let active = true;
    (async () => {
      try {
        const rows = await caseService.getMyBookingsLike?.();
        // Use the same endpoint /api/cases/mine-as-client OR mine.
        // caseService exposes listMyCases() in this codebase.
        const list = rows || [];
        if (!active) return;
        const filtered = list.filter((c) => c && c.source === 'ecourts');
        setMyCnrs(filtered.map((c) => c.cnr).filter(Boolean));
      } catch {
        /* silent */
      }
    })();
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const activeCount = useMemo(
    () =>
      ['advocate', 'judge', 'litigant', 'state'].reduce(
        (n, k) => (filters[k] ? n + 1 : n),
        0
      ),
    [filters]
  );

  const update = (patch) => setFilters((prev) => ({ ...prev, ...patch }));
  const reset = () => {
    setFilters({
      advocate: '',
      judge: '',
      litigant: '',
      state: '',
      startDate: isoToday(0),
      endDate: isoToday(7),
    });
    setResults([]);
    setMeta({ totalHits: 0, totalPages: 0, page: 1 });
    setSearchedOnce(false);
    setError('');
  };

  const runSearch = useCallback(
    async (targetPage = 1) => {
      setLoading(true);
      setError('');
      try {
        const payload = await searchCauselist({
          advocate: filters.advocate || undefined,
          judge: filters.judge || undefined,
          litigant: filters.litigant || undefined,
          state: filters.state || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          page: targetPage,
          pageSize: PAGE_SIZE,
        });
        const rows = (payload && payload.results) || [];
        setResults(rows);
        setMeta({
          totalHits: payload?.totalHits ?? rows.length,
          totalPages: payload?.totalPages ?? 1,
          page: payload?.page ?? targetPage,
          hasNextPage: !!payload?.hasNextPage,
          hasPreviousPage: !!payload?.hasPreviousPage,
        });
        setSearchedOnce(true);
      } catch (err) {
        setError(err.message || 'Search failed. Please try again.');
        setResults([]);
        setMeta({ totalHits: 0, totalPages: 0, page: 1 });
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  function handleSubmit(e) {
    e.preventDefault();
    runSearch(1);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative isolate overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 py-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-500/20 blur-3xl"
          />
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-start">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                <CalendarRange size={13} />
                Daily cause list
              </span>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                When is your matter listed?
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">
                Search the live cause list across every connected court for
                the next seven days. Filter by judge, advocate or litigant.
              </p>
            </div>
          </div>
        </section>

        {/* Search form */}
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Advocate
                  </span>
                  <div className="relative mt-1">
                    <User
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      value={filters.advocate}
                      onChange={(e) => update({ advocate: e.target.value })}
                      placeholder="Advocate name"
                      className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Judge
                  </span>
                  <div className="relative mt-1">
                    <Gavel
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      value={filters.judge}
                      onChange={(e) => update({ judge: e.target.value })}
                      placeholder="Presiding judge"
                      className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Litigant
                  </span>
                  <div className="relative mt-1">
                    <Users2
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      value={filters.litigant}
                      onChange={(e) => update({ litigant: e.target.value })}
                      placeholder="Petitioner or respondent"
                      className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    />
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    From
                  </span>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => update({ startDate: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    To
                  </span>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => update({ endDate: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    State (optional)
                  </span>
                  <select
                    value={filters.state}
                    onChange={(e) => update({ state: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                  >
                    <option value="">All states</option>
                    {states.map((s) => (
                      <option
                        key={s.code || s.stateCode || s.name}
                        value={s.code || s.stateCode || s.name}
                      >
                        {s.name || s.label || s.code}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                  <Filter size={12} />
                  {activeCount > 0
                    ? `${activeCount} narrow filter${activeCount === 1 ? '' : 's'} set`
                    : 'No filters — searches the whole window'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    Reset
                  </button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Searching…
                      </>
                    ) : (
                      <>
                        <Search size={14} />
                        Search hearings
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>

            {/* My-hearings shortcut — only shows when the user has saved
                E-Courts cases. Pre-fills the litigant filter with the
                CNR list so the next click runs a focused search. */}
            {!authLoading && myCnrs.length > 0 ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
                <Sparkles size={14} className="mt-0.5 shrink-0 text-violet-600" />
                <div className="flex-1 text-xs text-violet-900">
                  <p className="font-semibold">
                    {myCnrs.length} of your saved cases are tracked on
                    E-Courts.
                  </p>
                  <p>
                    Tip: paste an advocate or litigant name above and search to
                    see only your matters listed in the next week.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* Results */}
        <section className="bg-slate-50 py-10">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            {error ? (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
                  />
                ))}
              </div>
            ) : searchedOnce ? (
              <>
                <div className="mb-4 flex items-baseline justify-between">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">
                      {Number(meta.totalHits || 0).toLocaleString('en-IN')}
                    </span>{' '}
                    {meta.totalHits === 1 ? 'hearing' : 'hearings'} found
                  </p>
                  {meta.totalPages > 1 ? (
                    <p className="text-xs text-slate-500">
                      Page{' '}
                      <span className="font-semibold text-slate-700">
                        {meta.page}
                      </span>{' '}
                      of{' '}
                      <span className="font-semibold text-slate-700">
                        {meta.totalPages}
                      </span>
                    </p>
                  ) : null}
                </div>
                {results.length === 0 ? (
                  <Card className="text-center">
                    <Scale className="mx-auto h-10 w-10 text-slate-300" />
                    <h3 className="mt-2 text-base font-semibold text-slate-900">
                      No matching listings
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Try a different date window or remove one of the
                      filters.
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {results.map((entry, i) => (
                      <EntryRow
                        key={`${entry.cnr || entry.id || 'e'}-${i}`}
                        entry={entry}
                      />
                    ))}
                  </div>
                )}
                {meta.totalPages > 1 ? (
                  <div className="mt-6 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => runSearch(meta.page - 1)}
                      disabled={!meta.hasPreviousPage || loading}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft size={16} />
                      Prev
                    </button>
                    <span className="px-3 text-sm text-slate-600">
                      {meta.page} / {meta.totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => runSearch(meta.page + 1)}
                      disabled={!meta.hasNextPage || loading}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState
                icon={<CalendarRange size={24} />}
                title="Pick a date range to begin"
                description="Default is today through next week. Add a name to narrow the list."
              />
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
