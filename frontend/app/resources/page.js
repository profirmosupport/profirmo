// /resources — topic-cluster landing per strategy §4. Surfaces the
// existing /blog content organised by cluster (Property & Rent, Family,
// Employment, Consumer & Cheque, GST, ITR, Company & Startups, NRI,
// Freelancer/Creator Tax) so readers can navigate by theme. The
// underlying posts continue to live at /blog/<slug>; /resources/ is
// purely an index.

import Link from 'next/link';
import {
  Home as HomeIcon,
  Heart,
  Briefcase,
  ShoppingBag,
  Receipt,
  FileText,
  Rocket,
  Globe2,
  Coins,
  Library,
} from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import LeadGenFloater from '@/components/common/LeadGenFloater';
import JsonLd, { breadcrumb, webPage } from '@/components/seo/JsonLd';
import { API_BASE_URL } from '@/utils/constants';

const PAGE_TITLE = 'Resources & Topic Clusters · Pro Firmo';
const PAGE_DESC =
  'Plain-English Indian-law explainers organised by topic — property & rent, family, employment, consumer & cheque bounce, GST, income tax, company & startups, NRI, freelancer tax.';

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESC,
  alternates: { canonical: '/resources' },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESC,
    url: '/resources',
    siteName: 'Pro Firmo',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: PAGE_TITLE, description: PAGE_DESC },
};

const JSON_LD = [
  webPage({
    url: '/resources',
    name: PAGE_TITLE,
    description: PAGE_DESC,
    type: 'CollectionPage',
  }),
  breadcrumb([
    { name: 'Home', url: '/' },
    { name: 'Resources', url: '/resources' },
  ]),
];

const CLUSTERS = [
  {
    slug: 'property-and-rent',
    title: 'Property & Rent',
    icon: 'HomeIcon',
    accent: 'amber',
    description:
      'Title disputes, partition, RERA, rental agreements, NRI property, encumbrance, builder issues.',
    matchTags: ['property', 'rent', 'rera', 'nri', 'real-estate'],
    pillar: '/services/company-registration-and-roc',
  },
  {
    slug: 'family-and-matrimonial',
    title: 'Family & Matrimonial',
    icon: 'Heart',
    accent: 'rose',
    description:
      'Divorce, maintenance, custody, alimony, the new BNS cruelty law, prenups, grey divorce, joint debt.',
    matchTags: ['family', 'matrimonial', 'divorce', 'alimony', 'maintenance', 'family-matrimonial-law'],
    pillar: '/services/divorce-and-family-consultation',
  },
  {
    slug: 'employment',
    title: 'Employment & Workplace',
    icon: 'Briefcase',
    accent: 'rose',
    description:
      'Termination, salary recovery, gratuity, F&F, non-compete, POSH, labour codes, full and final.',
    matchTags: ['employment', 'labour', 'salary', 'workplace', 'posh'],
    pillar: '/services/employment-and-salary-dispute',
  },
  {
    slug: 'consumer-and-cheque',
    title: 'Consumer & Cheque Bounce',
    icon: 'ShoppingBag',
    accent: 'teal',
    description:
      'Consumer Protection Act 2019, district / state / national commissions, Section 138 NI Act timelines.',
    matchTags: ['consumer', 'cheque', 'cheque-bounce', 'ni-act'],
    pillar: '/services/consumer-complaint-consultation',
  },
  {
    slug: 'gst',
    title: 'GST',
    icon: 'Receipt',
    accent: 'teal',
    description:
      'Registration, returns, ITC, audit, notices under §73 / §74, refunds, e-invoicing, GSTAT.',
    matchTags: ['gst', 'gst-council', 'gst-return', 'itc', 'gst-notice'],
    pillar: '/services/gst-consultation',
  },
  {
    slug: 'income-tax-itr',
    title: 'Income Tax & ITR',
    icon: 'FileText',
    accent: 'indigo',
    description:
      'ITR forms, old vs new regime, deductions, capital gains, NRI return, AIS / TIS, faceless assessment.',
    matchTags: ['income-tax', 'itr', 'tax', 'faceless-assessment', 'tds'],
    pillar: '/services/income-tax-itr',
  },
  {
    slug: 'company-and-startups',
    title: 'Company & Startups',
    icon: 'Rocket',
    accent: 'indigo',
    description:
      'Incorporation, ROC compliance, DPIIT, ESOPs, fundraising paperwork, founders agreements, FEMA.',
    matchTags: ['company', 'startup', 'esop', 'dpiit', 'incorporation', 'msme'],
    pillar: '/services/startup-compliance',
  },
  {
    slug: 'nri-services',
    title: 'NRI Services',
    icon: 'Globe2',
    accent: 'teal',
    description:
      'FEMA, NRI property buying/selling, repatriation, Power of Attorney, NRI tax (DTAA, Schedule FA).',
    matchTags: ['nri', 'fema', 'repatriation', 'dtaa'],
    pillar: '/services/nri-property-legal-help',
  },
  {
    slug: 'freelancer-and-creator-tax',
    title: 'Freelancer & Creator Tax',
    icon: 'Coins',
    accent: 'amber',
    description:
      'Presumptive 44ADA, freelance GST, foreign-income invoicing, advance tax, creator-economy compliance.',
    matchTags: ['freelancer', 'creator', '44ada', 'presumptive'],
    pillar: '/services/income-tax-itr',
  },
];

const ICONS = { HomeIcon, Heart, Briefcase, ShoppingBag, Receipt, FileText, Rocket, Globe2, Coins };

// EC2 + nginx + LE at proapi.profirmo.com (was profirmo.onrender.com).
const PRODUCTION_API_URL = 'https://proapi.profirmo.com';

function apiBase() {
  if (process.env.API_BACKEND_URL) return process.env.API_BACKEND_URL;
  if (typeof API_BASE_URL === 'string' && API_BASE_URL.includes('localhost')) {
    return API_BASE_URL;
  }
  return PRODUCTION_API_URL;
}

async function fetchPosts() {
  try {
    const res = await fetch(`${apiBase()}/api/blog/posts?limit=200`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body && Array.isArray(body.data) ? body.data : (Array.isArray(body) ? body : []);
  } catch {
    return [];
  }
}

function matchCluster(post, cluster) {
  const text =
    `${post.slug || ''} ${(post.tagSlugs || []).join(' ')} ${(post.tagNames || []).join(' ')} ${
      (post.categoryName || '')
    } ${(post.categorySlug || '')}`.toLowerCase();
  return cluster.matchTags.some((t) => text.includes(t));
}

export default async function ResourcesPage() {
  const posts = await fetchPosts();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <JsonLd data={JSON_LD} />
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
          <div className="pointer-events-none absolute -right-32 top-0 h-72 w-72 rounded-full bg-amber-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -left-32 bottom-0 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-200">
              <Library size={12} />
              Pro Firmo Resources
            </span>
            <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
              Plain-English Indian-law explainers, by topic.
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
              Nine topic clusters covering the Indian-law questions readers
              search before they need an expert. Authored by Pro Firmo
              editorial; reviewed by panel professionals.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CLUSTERS.map((c) => {
              const Icon = ICONS[c.icon];
              const inCluster = posts.filter((p) => matchCluster(p, c)).slice(0, 4);
              return (
                <li key={c.slug}>
                  <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-xl bg-${c.accent}-100 text-${c.accent}-700`}
                      >
                        {Icon ? <Icon size={18} /> : null}
                      </span>
                      <h2 className="text-base font-semibold text-slate-900">
                        {c.title}
                      </h2>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-slate-600">
                      {c.description}
                    </p>
                    {inCluster.length > 0 ? (
                      <ul className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                        {inCluster.map((p) => (
                          <li key={p.slug}>
                            <Link
                              href={`/blog/${p.slug}`}
                              className="block truncate text-xs font-medium text-amber-700 hover:underline"
                            >
                              {p.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 text-[11px] text-slate-400">
                        No posts in this cluster yet — coming soon.
                      </p>
                    )}
                    <div className="mt-auto pt-4">
                      <Link
                        href={c.pillar}
                        className="text-xs font-semibold text-teal-700 hover:underline"
                      >
                        Read the {c.title} guide →
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
      <Footer />
      <LeadGenFloater source="resources-index" />
    </div>
  );
}
