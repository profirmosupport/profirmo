// /blog/[slug] — public blog post detail.
//
// This is a Server Component so `generateMetadata` can produce the SEO +
// OG + Twitter tags directly from the post payload. The body itself is
// hydrated from server-fetched HTML; share buttons run client-side.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calendar, Clock, ArrowLeft, Tag, User2 } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import LeadGenFloater from '@/components/common/LeadGenFloater';
import ShareButtons from '@/components/blog/ShareButtons';
import { ssrGetPost } from '@/services/blogService';

// Used to build absolute URLs for OG / Twitter / canonical tags. The SSR
// path has no `window.location` to read from, so we layer the lookup:
//   1. NEXT_PUBLIC_SITE_URL  (build-time bake — recommended)
//   2. NEXT_PUBLIC_APP_URL   (older env name, kept for back-compat)
//   3. In production: the known public host so scrapers never see localhost
//   4. Otherwise: local dev
function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NODE_ENV === 'production') return 'https://profirmo.com';
  return 'http://localhost:3000';
}

function absoluteUrl(maybePath) {
  if (!maybePath) return null;
  if (/^https?:\/\//.test(maybePath)) return maybePath;
  return `${siteUrl().replace(/\/$/, '')}${
    maybePath.startsWith('/') ? '' : '/'
  }${maybePath}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * Next.js metadata API. Pulls the post server-side and projects
 * title / description / OG / Twitter / canonical fields. When the post
 * doesn't exist we return a minimal metadata object — `notFound()` from
 * the page itself shows the 404 UI.
 */
export async function generateMetadata({ params }) {
  const post = await ssrGetPost(params.slug);
  if (!post) return { title: 'Post not found · Profirmo Journal' };

  const title = post.seoTitle || post.title;
  const description =
    post.seoDescription ||
    post.excerpt ||
    'Read the latest stories from Profirmo.';
  const ogTitle = post.ogTitle || title;
  const ogDescription = post.ogDescription || description;
  const ogImage = absoluteUrl(post.ogImage || post.featuredImage);
  const url = `${siteUrl().replace(/\/$/, '')}/blog/${post.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: ogTitle,
      description: ogDescription,
      siteName: 'Profirmo',
      publishedTime: post.publishedAt || post.createdAt,
      modifiedTime: post.updatedAt,
      authors: post.authorName ? [post.authorName] : undefined,
      tags: Array.isArray(post.tags) ? post.tags.map((t) => t.name) : undefined,
      images: ogImage ? [{ url: ogImage, alt: post.title }] : undefined,
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: ogTitle,
      description: ogDescription,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }) {
  const post = await ssrGetPost(params.slug);
  if (!post) notFound();

  const url = `/blog/${post.slug}`;
  const category = post.category;
  const tags = Array.isArray(post.tags) ? post.tags : [];

  // JSON-LD for richer SERPs. Kept inline as a <script> tag so Next.js
  // doesn't strip it from the static HTML during prerendering.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.seoDescription || post.excerpt || '',
    image: absoluteUrl(post.ogImage || post.featuredImage) || undefined,
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.updatedAt,
    author: post.authorName
      ? { '@type': 'Person', name: post.authorName }
      : undefined,
    mainEntityOfPage: `${siteUrl().replace(/\/$/, '')}/blog/${post.slug}`,
    keywords: tags.map((t) => t.name).join(', '),
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        {/* Top crumb — sits on white above the cover so it's never
            confused with the heading. */}
        <nav className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:px-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-amber-700"
          >
            <ArrowLeft size={14} />
            Back to journal
          </Link>
        </nav>

        {/* Cover image — full-bleed banner, NO text overlay. Falls back
            to a warm gradient when no featured image is set so the page
            still feels intentional. */}
        {/* LCP — the cover image is the largest element above the fold for
            blog detail pages. Preload it in <head> so the browser starts the
            fetch in parallel with the CSS chunk, and mark the <img> itself
            as eager + high-priority so it's not deferred by the lazy-image
            heuristic. The SSR'd HTML gives us the URL up front. */}
        {post.featuredImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-head-element */}
            <link
              rel="preload"
              as="image"
              href={post.featuredImage}
              // Tells the browser this is the LCP candidate.
              // eslint-disable-next-line react/no-unknown-property
              fetchpriority="high"
            />
            <figure className="mx-auto mt-5 max-w-5xl overflow-hidden px-4 sm:px-6 lg:px-8">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-card">
                <img
                  src={post.featuredImage}
                  alt={post.title}
                  width="1200"
                  height="675"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  className="aspect-[16/9] w-full object-cover"
                />
              </div>
            </figure>
          </>
        ) : (
          <div className="mx-auto mt-5 max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="aspect-[16/9] w-full overflow-hidden rounded-3xl bg-gradient-to-br from-amber-100 via-amber-50 to-white" />
          </div>
        )}

        {/* Title block — sits cleanly BELOW the cover on a white field.
            Heading never overlays the image. */}
        <section className="mx-auto max-w-3xl px-4 pb-2 pt-10 sm:px-6 sm:pt-12 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {category && (
              <Link
                href={`/blog?categorySlug=${category.slug}`}
                className="inline-flex items-center rounded-full bg-amber-600 px-3 py-1 font-semibold text-white shadow-sm transition hover:bg-amber-700"
              >
                {category.name}
              </Link>
            )}
            {post.publishedAt && (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <Calendar size={12} />
                {fmtDate(post.publishedAt)}
              </span>
            )}
            {post.readingMinutes && (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <Clock size={12} />
                {post.readingMinutes} min read
              </span>
            )}
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              {post.excerpt}
            </p>
          )}
          {post.authorName && (
            <div className="mt-6 flex items-center gap-3 border-y border-slate-100 py-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <User2 size={16} />
              </span>
              <div className="text-sm">
                <p className="font-semibold text-slate-800">
                  {post.authorName}
                </p>
                <p className="text-xs text-slate-500">
                  {post.publishedAt
                    ? `Published ${fmtDate(post.publishedAt)}`
                    : 'Profirmo Journal'}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Body — typography handled with prose-like inline styles since
            we don't ship the Tailwind typography plugin. */}
        <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-10 pt-6 sm:px-6 sm:pb-12 sm:pt-8 lg:grid-cols-[64px_1fr] lg:gap-12 lg:px-8 lg:pb-16">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 lg:text-center">
              Share
            </p>
            <ShareButtons
              url={url}
              title={post.title}
              description={post.excerpt || ''}
            />
          </aside>

          <article className="max-w-3xl">
            <div
              className="blog-body text-base leading-relaxed text-slate-800 [&_a]:text-amber-700 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-amber-400 [&_blockquote]:bg-amber-50 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:italic [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-slate-900 [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-slate-900 [&_img]:my-6 [&_img]:rounded-xl [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-slate-100 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
              dangerouslySetInnerHTML={{ __html: post.content || '' }}
            />

            {tags.length > 0 && (
              <div className="mt-10 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-6">
                <Tag size={14} className="text-slate-400" />
                <span className="mr-1 text-xs font-semibold text-slate-500">
                  Tagged
                </span>
                {tags.map((t) => (
                  <Link
                    key={t.id}
                    href={`/blog?tagSlug=${t.slug}`}
                    className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-amber-100 hover:text-amber-800"
                  >
                    #{t.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Inline share row for mobile (the aside above is hidden < lg). */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:hidden">
              <p className="text-sm font-semibold text-slate-700">
                Found this useful? Share it.
              </p>
              <ShareButtons
                url={url}
                title={post.title}
                description={post.excerpt || ''}
              />
            </div>
          </article>
        </section>
      </main>
      <Footer />
      <LeadGenFloater source={`blog-${post.slug}`} />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
