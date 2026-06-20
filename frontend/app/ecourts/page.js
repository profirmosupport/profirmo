'use client';

// E-Courts India case lookup. Server-side proxy at /api/ecourts/* talks
// to https://webapi.ecourtsindia.com using the partner API key stored in
// admin settings — the browser never sees the key.
//
// UI mirrors ecourtsindia.com's own search experience: one big query
// box for "anywhere" plus 5 narrower filters (advocates, judges,
// petitioners, respondents, litigants). Results render as a list of
// case cards linking to /ecourts/[cnr].

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Scale,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Gavel,
  Users2,
  UserCheck,
  Briefcase,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  FileText,
  Calendar,
  Loader2,
  MapPin,
} from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import LeadGenFloater from '@/components/common/LeadGenFloater';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import {
  getCaseByCnr,
  looksLikeCnr,
  refreshAsAdd,
  searchCases,
} from '@/services/ecourtsService';

const PAGE_SIZE = 12;

const FILTER_FIELDS = [
  {
    key: 'advocates',
    label: 'Advocate',
    placeholder: 'e.g. Harish Salve',
    icon: Briefcase,
  },
  {
    key: 'judges',
    label: 'Judge',
    placeholder: 'e.g. D.Y. Chandrachud',
    icon: Gavel,
  },
  {
    key: 'petitioners',
    label: 'Petitioner',
    placeholder: 'Name of the petitioner',
    icon: UserCheck,
  },
  {
    key: 'respondents',
    label: 'Respondent',
    placeholder: 'Name of the respondent',
    icon: Users2,
  },
  {
    key: 'litigants',
    label: 'Litigant (either side)',
    placeholder: 'Petitioner OR respondent',
    icon: ShieldCheck,
  },
];

const EMPTY = {
  query: '',
  advocates: '',
  judges: '',
  petitioners: '',
  respondents: '',
  litigants: '',
};

function CaseStatusBadge({ status }) {
  const s = String(status || '').toUpperCase();
  const tone = s.includes('DISPOSED')
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : s.includes('PEND')
      ? 'bg-amber-50 text-amber-700 ring-amber-200'
      : 'bg-slate-50 text-slate-600 ring-slate-200';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${tone}`}
    >
      {status || 'Unknown'}
    </span>
  );
}

function formatList(arr, max = 2) {
  if (!Array.isArray(arr) || arr.length === 0) return '—';
  const head = arr.slice(0, max).filter(Boolean).join(', ');
  if (arr.length <= max) return head;
  return `${head} +${arr.length - max} more`;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

function ResultCard({ item }) {
  const title =
    (Array.isArray(item.petitioners) && item.petitioners[0]) ||
    item.cnr ||
    'Untitled case';
  const respondent =
    (Array.isArray(item.respondents) && item.respondents[0]) || '';
  return (
    <Link
      href={`/ecourts/${encodeURIComponent(item.cnr)}`}
      className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-glow-amber"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
            {item.cnr}
          </p>
          <h3 className="mt-1 truncate text-base font-semibold text-slate-900 group-hover:text-amber-700">
            {title}
            {respondent ? (
              <span className="font-normal text-slate-400"> vs </span>
            ) : null}
            {respondent ? (
              <span className="text-slate-700">{respondent}</span>
            ) : null}
          </h3>
        </div>
        <CaseStatusBadge status={item.caseStatus} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2">
        {item.caseType ? (
          <div className="flex items-center gap-1.5">
            <FileText size={13} className="text-slate-400" />
            <span className="font-semibold text-slate-500">Type:</span>
            <span>{item.caseType}</span>
          </div>
        ) : null}
        {item.courtCode ? (
          <div className="flex items-center gap-1.5">
            <MapPin size={13} className="text-slate-400" />
            <span className="font-semibold text-slate-500">Court:</span>
            <span>{item.courtCode}</span>
          </div>
        ) : null}
        {item.filingDate ? (
          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-slate-400" />
            <span className="font-semibold text-slate-500">Filed:</span>
            <span>{formatDate(item.filingDate)}</span>
          </div>
        ) : null}
        {item.nextHearingDate ? (
          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-amber-500" />
            <span className="font-semibold text-slate-500">Next hearing:</span>
            <span>{formatDate(item.nextHearingDate)}</span>
          </div>
        ) : null}
      </div>

      {Array.isArray(item.judges) && item.judges.length > 0 ? (
        <p className="mt-2.5 text-xs text-slate-500">
          <span className="font-semibold text-slate-600">Judges:</span>{' '}
          {formatList(item.judges, 2)}
        </p>
      ) : null}
      {Array.isArray(item.petitionerAdvocates) &&
      item.petitionerAdvocates.length > 0 ? (
        <p className="mt-1 text-xs text-slate-500">
          <span className="font-semibold text-slate-600">Advocates:</span>{' '}
          {formatList(item.petitionerAdvocates, 2)}
        </p>
      ) : null}

      <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 group-hover:text-amber-800">
        View case detail
        <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export default function ECourtsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [filters, setFilters] = useState(EMPTY);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const [page, setPage] = useState(1);
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState({
    totalHits: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Refresh-as-add fallback state. When a CNR-shaped query returns 0
  // hits in the partner search index, the backend POSTs /refresh
  // upstream (returns "QUEUED" with 5–10 min ETA), then we poll
  // /case/:cnr from the browser until it lands.
  const [fetchingFromSource, setFetchingFromSource] = useState(false);
  const [fetchInfo, setFetchInfo] = useState(null); // { eta, elapsedS }
  const [refreshHint, setRefreshHint] = useState('');
  const fetchAbortRef = useRef(null);
  const requestIdRef = useRef(0);

  const activeCount = useMemo(
    () =>
      Object.entries(filters).reduce(
        (n, [, v]) => (String(v || '').trim() ? n + 1 : n),
        0
      ),
    [filters]
  );

  const update = (patch) => setFilters((prev) => ({ ...prev, ...patch }));
  const reset = () => {
    setFilters(EMPTY);
    setResults([]);
    setMeta({ totalHits: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 });
    setSearchedOnce(false);
    setError('');
    setPage(1);
  };

  const doSearch = useCallback(
    async (targetPage) => {
      if (activeCount === 0) {
        setError('Enter at least one search term to look up a case.');
        return;
      }
      const myReq = ++requestIdRef.current;
      setLoading(true);
      setError('');
      setRefreshHint('');
      try {
        const payload = await searchCases({
          ...filters,
          page: targetPage,
          pageSize: PAGE_SIZE,
        });
        if (requestIdRef.current !== myReq) return;
        const rows = (payload && payload.results) || [];
        setResults(rows);
        setMeta({
          totalHits: payload?.totalHits ?? rows.length,
          page: payload?.page ?? targetPage,
          pageSize: payload?.pageSize ?? PAGE_SIZE,
          totalPages: payload?.totalPages ?? 1,
          hasNextPage: !!payload?.hasNextPage,
          hasPreviousPage: !!payload?.hasPreviousPage,
        });
        setSearchedOnce(true);
        setPage(targetPage);
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 280, behavior: 'smooth' });
        }

        // --- Refresh-as-add fallback -------------------------------
        // Partner search index lags 1–2 hours behind the case-detail
        // endpoint, and brand-new CNRs may not be in their DB at all.
        // If the user typed a CNR-shaped value and we got 0 hits,
        // ask the backend to trigger an upstream rescrape (which also
        // adds unknown CNRs) and then deep-link straight to the
        // detail page once it lands.
        // Fire refresh-as-add whenever the main query box holds a
        // CNR-shaped value and the search returned nothing — even if
        // narrow filters are set (those don't apply to a CNR lookup).
        // Only on the first page; pagination should never re-kick.
        const q = String(filters.query || '').trim();
        const cnrShaped = looksLikeCnr(q) && targetPage === 1;
        if (rows.length === 0 && cnrShaped) {
          if (!isAuthenticated) {
            setRefreshHint(
              'Looks like a CNR. Sign in to fetch this case directly from the source.'
            );
            return;
          }
          // Drop the search skeleton so the dedicated "Fetching from
          // source…" card takes over while we run the kick-and-poll
          // flow against the partner API.
          setLoading(false);
          setFetchingFromSource(true);
          setFetchInfo({ eta: '5–10 minutes', elapsedS: 0 });

          // Cancel any in-flight poll the moment a new search starts.
          if (fetchAbortRef.current) {
            fetchAbortRef.current.cancelled = true;
          }
          const ctrl = { cancelled: false };
          fetchAbortRef.current = ctrl;

          try {
            const kicked = await refreshAsAdd(q);
            if (requestIdRef.current !== myReq || ctrl.cancelled) return;

            // Lucky path: partner had the case cached already.
            if (kicked && kicked.ready && kicked.case) {
              router.push(`/ecourts/${encodeURIComponent(q)}`);
              return;
            }

            const queueEta =
              (kicked && kicked.queue && kicked.queue.estimatedTime) ||
              '5–10 minutes';
            setFetchInfo({ eta: String(queueEta), elapsedS: 0 });

            // Poll the case-detail endpoint from the browser. Each
            // GET costs one case-detail credit upstream, so we space
            // them generously (15s) and cap the loop at 2 minutes —
            // past that the user gets a "check back later" hint so
            // they aren't stuck watching a spinner.
            const POLL_INTERVAL_MS = 15000;
            const MAX_WAIT_MS = 2 * 60 * 1000;
            const start = Date.now();
            // Tick the elapsed counter every second so the UI shows a
            // moving counter without driving each tick from the poll.
            const tickHandle = setInterval(() => {
              if (ctrl.cancelled) return;
              setFetchInfo((prev) =>
                prev
                  ? { ...prev, elapsedS: Math.floor((Date.now() - start) / 1000) }
                  : prev
              );
            }, 1000);

            try {
              while (
                !ctrl.cancelled &&
                Date.now() - start < MAX_WAIT_MS
              ) {
                await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
                if (ctrl.cancelled || requestIdRef.current !== myReq) return;
                try {
                  const data = await getCaseByCnr(q);
                  if (ctrl.cancelled) return;
                  if (data && data.courtCaseData) {
                    router.push(`/ecourts/${encodeURIComponent(q)}`);
                    return;
                  }
                } catch (pollErr) {
                  // 404 just means the rescrape hasn't landed yet —
                  // keep going. Anything else surfaces in the hint.
                  if (pollErr && pollErr.status !== 404) {
                    throw pollErr;
                  }
                }
              }
              if (!ctrl.cancelled) {
                setRefreshHint(
                  "E-Courts is still fetching this CNR. Check back in a few minutes — the case will be ready by then."
                );
              }
            } finally {
              clearInterval(tickHandle);
            }
          } catch (refreshErr) {
            if (requestIdRef.current !== myReq || ctrl.cancelled) return;
            // Defensive coercion — some upstream errors arrive with a
            // non-string `message`. Guard against React rendering an
            // object as text ("[object Object]").
            const msg =
              typeof refreshErr?.message === 'string'
                ? refreshErr.message
                : 'Could not fetch this CNR from source. Try again later.';
            setRefreshHint(msg);
          } finally {
            if (requestIdRef.current === myReq && !ctrl.cancelled) {
              setFetchingFromSource(false);
              setFetchInfo(null);
            }
          }
        }
      } catch (err) {
        if (requestIdRef.current !== myReq) return;
        setError(err.message || 'Search failed. Please try again.');
        setResults([]);
        setMeta({ totalHits: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 });
      } finally {
        if (requestIdRef.current === myReq) setLoading(false);
      }
    },
    [filters, activeCount, isAuthenticated, router]
  );

  function handleSubmit(e) {
    e.preventDefault();
    doSearch(1);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative isolate overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 py-16 sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-32 -top-24 h-80 w-80 rounded-full bg-amber-500/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-32 h-80 w-80 rounded-full bg-teal-500/15 blur-3xl"
          />

          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                <Sparkles size={13} />
                Powered By E-Courts India
              </span>
              <h1 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-5xl">
                Look up any{' '}
                <span className="text-gradient-light">Indian court</span> case
              </h1>
              <p className="mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
                Search by case ID (CNR), advocate, judge, or party name across
                the Supreme Court, all 25 High Courts and 1000+ District
                Courts. Read the order sheet, download true-copy PDFs.
              </p>
            </div>

            {/* Search form */}
            <form
              onSubmit={handleSubmit}
              className="mt-10 rounded-3xl border border-white/10 bg-white p-5 shadow-2xl sm:p-7"
            >
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Search anywhere
                </span>
                <div className="relative mt-1.5">
                  <Search
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    autoFocus
                    value={filters.query}
                    onChange={(e) => update({ query: e.target.value })}
                    placeholder="CNR number, case title, party name or any keyword…"
                    className="w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-11 pr-4 text-base text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Full-text search across CNR, parties, advocates, judges,
                  case type — tries the smartest match across all fields.
                </p>
              </label>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {FILTER_FIELDS.map(({ key, label, placeholder, icon: Icon }) => (
                  <label key={key} className="block">
                    <span className="text-xs font-semibold text-slate-600">
                      {label}
                    </span>
                    <div className="relative mt-1">
                      <Icon
                        size={14}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        value={filters[key]}
                        onChange={(e) => update({ [key]: e.target.value })}
                        placeholder={placeholder}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      />
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  {activeCount > 0 ? (
                    <span>
                      <span className="font-semibold text-slate-900">
                        {activeCount}
                      </span>{' '}
                      filter{activeCount === 1 ? '' : 's'} set
                    </span>
                  ) : (
                    <span>Enter at least one term to search.</span>
                  )}
                </div>
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
                    disabled={loading || activeCount === 0}
                  >
                    <Search size={15} />
                    {loading ? 'Searching…' : 'Search cases'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </section>

        {/* Results */}
        <section className="bg-slate-50 py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            {error ? (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white"
                  />
                ))}
              </div>
            ) : searchedOnce ? (
              <>
                <div className="mb-4 flex items-baseline justify-between">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">
                      {meta.totalHits.toLocaleString('en-IN')}
                    </span>{' '}
                    {meta.totalHits === 1 ? 'case' : 'cases'} found
                  </p>
                  {meta.totalPages > 0 ? (
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
                  fetchingFromSource ? (
                    <Card className="flex items-start gap-3 text-left">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-slate-900">
                          Fetching this CNR directly from E-Courts…
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          This case isn't in the partner index yet, so we've
                          queued a fresh scrape from the source court site.
                          Typical wait:{' '}
                          <span className="font-semibold text-slate-700">
                            {fetchInfo?.eta || '5–10 minutes'}
                          </span>
                          .
                        </p>
                        <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                          Elapsed{' '}
                          {Math.floor((fetchInfo?.elapsedS || 0) / 60)
                            .toString()
                            .padStart(2, '0')}
                          :
                          {((fetchInfo?.elapsedS || 0) % 60)
                            .toString()
                            .padStart(2, '0')}{' '}
                          · checking every 15s
                        </p>
                        <p className="mt-2 text-[11px] text-slate-400">
                          You can leave this tab — the page will navigate
                          automatically when the case lands.
                        </p>
                      </div>
                    </Card>
                  ) : refreshHint ? (
                    <Card className="text-center">
                      <Sparkles className="mx-auto h-9 w-9 text-amber-500" />
                      <h3 className="mt-2 text-base font-semibold text-slate-900">
                        That looks like a CNR
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {String(refreshHint)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => doSearch(1)}
                          disabled={loading || fetchingFromSource}
                        >
                          {fetchingFromSource ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Fetching…
                            </>
                          ) : (
                            'Try again'
                          )}
                        </Button>
                        {!isAuthenticated ? (
                          <Button
                            href={`/login?next=${encodeURIComponent('/ecourts')}`}
                            variant="outline"
                            size="sm"
                          >
                            Sign in
                          </Button>
                        ) : null}
                      </div>
                    </Card>
                  ) : (
                    <Card className="text-center">
                      <Scale className="mx-auto h-10 w-10 text-slate-300" />
                      <h3 className="mt-2 text-base font-semibold text-slate-900">
                        No matching cases
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Try a different name spelling, a partial CNR, or
                        remove one of the filters.
                      </p>
                    </Card>
                  )
                ) : (
                  <div className="space-y-3">
                    {results.map((item) => (
                      <ResultCard key={item.cnr} item={item} />
                    ))}
                  </div>
                )}

                {meta.totalPages > 1 ? (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => doSearch(page - 1)}
                      disabled={page <= 1 || loading}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft size={16} />
                      Prev
                    </button>
                    <span className="px-3 text-sm text-slate-600">
                      {page} / {meta.totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => doSearch(page + 1)}
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
              <div className="space-y-4">
                <Card className="text-center">
                  <Scale className="mx-auto h-12 w-12 text-amber-400" />
                  <h3 className="mt-3 text-lg font-bold text-slate-900">
                    Search for any case in India
                  </h3>
                  <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                    Type a name or CNR above and hit Search. Results pull live
                    from the eCourts national database.
                  </p>
                </Card>

                {/* Quick link into the daily cause-list page, so the page
                    surfaces the other primary partner-API capability
                    without forcing the visitor to run a search first. */}
                <Link
                  href="/ecourts/hearings"
                  className="group flex flex-col gap-3 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-glow-amber sm:flex-row sm:items-center"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 group-hover:bg-amber-200">
                    <Sparkles className="h-6 w-6" />
                  </span>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-slate-900 group-hover:text-amber-800">
                      When is your matter listed?
                    </h3>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Daily cause list across every court — filter by judge,
                      advocate or party.
                    </p>
                  </div>
                  <ArrowRight
                    size={18}
                    className="text-amber-700 transition group-hover:translate-x-1"
                  />
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
      <LeadGenFloater source="ecourts" />
    </div>
  );
}
