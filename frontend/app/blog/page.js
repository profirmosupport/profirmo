'use client';

// /blog — public blog listing. The first published post renders as a wide
// featured hero card; everything else flows into a responsive 3-column
// grid. Category chips on top double as filters.

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  Search,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import LeadGenFloater from '@/components/common/LeadGenFloater';
import PostCard from '@/components/blog/PostCard';
import EmptyState from '@/components/common/EmptyState';
import {
  listPosts,
  listCategories,
} from '@/services/blogService';

function BlogPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get('categorySlug') || '';
  const tagSlug = searchParams.get('tagSlug') || '';
  const search = searchParams.get('search') || '';
  const page = Number(searchParams.get('page')) || 1;

  const [posts, setPosts] = useState([]);
  const [meta, setMeta] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState(search);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [{ items, meta: m }, cats] = await Promise.all([
        listPosts({
          page,
          limit: 12,
          categorySlug: categorySlug || undefined,
          tagSlug: tagSlug || undefined,
          search: search || undefined,
        }),
        listCategories(),
      ]);
      setPosts(items);
      setMeta(m);
      setCategories(cats);
    } catch (err) {
      setError(err.message || 'Failed to load blog.');
    } finally {
      setLoading(false);
    }
  }, [page, categorySlug, tagSlug, search]);

  useEffect(() => {
    load();
  }, [load]);

  function buildHref(patch) {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') next.delete(k);
      else next.set(k, String(v));
    });
    if (Object.keys(patch).includes('page') === false) next.delete('page');
    const qs = next.toString();
    return qs ? `/blog?${qs}` : '/blog';
  }

  function applySearch(e) {
    e.preventDefault();
    router.push(buildHref({ search: searchInput.trim() || undefined, page: 1 }));
  }

  const totalPages = (meta && meta.totalPages) || 1;
  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      <main className="flex-1">
        {/* Hero band */}
        <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-amber-50 via-white to-rose-50">
          <div className="absolute -right-24 top-0 h-72 w-72 rounded-full bg-amber-300/30 blur-3xl" />
          <div className="absolute -left-20 bottom-0 h-60 w-60 rounded-full bg-rose-300/30 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <div className="flex flex-col items-start gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                  <BookOpen size={13} />
                  Insights & news
                </span>
                <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                  The{' '}
                  <span className="bg-gradient-to-r from-amber-600 via-rose-500 to-violet-600 bg-clip-text text-transparent">
                    Profirmo
                  </span>{' '}
                  Journal
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                  Stories, deep dives and practical guides from legal &amp;
                  tax professionals across India.
                </p>
              </div>
              <form
                onSubmit={applySearch}
                className="flex w-full max-w-md items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-card focus-within:border-amber-400"
              >
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search the journal…"
                    className="w-full rounded-xl bg-transparent py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-glow-sm transition hover:shadow-glow"
                >
                  Search
                </button>
              </form>
            </div>

            {/* Category chips */}
            {categories.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center gap-2">
                <Link
                  href={buildHref({ categorySlug: undefined, tagSlug: undefined, page: 1 })}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    !categorySlug && !tagSlug
                      ? 'bg-slate-900 text-white shadow'
                      : 'bg-white text-slate-700 hover:bg-amber-50'
                  }`}
                >
                  All posts
                </Link>
                {categories.map((c) => (
                  <Link
                    key={c.id}
                    href={buildHref({ categorySlug: c.slug, page: 1 })}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      c.slug === categorySlug
                        ? 'bg-amber-600 text-white shadow'
                        : 'bg-white text-slate-700 hover:bg-amber-50'
                    }`}
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          {error && (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={load}
                className="text-xs font-medium hover:underline"
              >
                <RefreshCw size={12} className="mr-1 inline" />
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white"
                />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={24} />}
              title="No posts yet"
              description={
                search || categorySlug || tagSlug
                  ? 'No posts match your filters — try removing one.'
                  : "We're working on the first stories. Check back soon."
              }
            />
          ) : (
            <div className="space-y-8">
              {featured && page === 1 && !search && !categorySlug && !tagSlug && (
                <PostCard post={featured} featured />
              )}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {(featured && page === 1 && !search && !categorySlug && !tagSlug
                  ? rest
                  : posts
                ).map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-6">
                  <Link
                    href={buildHref({ page: page > 1 ? page - 1 : undefined })}
                    className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      page <= 1
                        ? 'pointer-events-none border-slate-100 text-slate-300'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:text-amber-700'
                    }`}
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </Link>
                  <span className="px-3 text-sm text-slate-600">
                    Page <span className="font-semibold text-slate-900">{page}</span>{' '}
                    of {totalPages}
                  </span>
                  <Link
                    href={buildHref({ page: page < totalPages ? page + 1 : undefined })}
                    className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      page >= totalPages
                        ? 'pointer-events-none border-slate-100 text-slate-300'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:text-amber-700'
                    }`}
                  >
                    Next
                    <ChevronRight size={16} />
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
      <Footer />
      <LeadGenFloater source="blog-index" />
    </div>
  );
}

export default function BlogPage() {
  return (
    <Suspense fallback={null}>
      <BlogPageInner />
    </Suspense>
  );
}
