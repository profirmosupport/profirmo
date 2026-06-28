// /for-professionals — supply-side hub per strategy §4 / §6. Pitches the
// platform to verified tax, GST, CA, CS, and documentation professionals.
// Deliberately positioned ALONGSIDE — not as a competitor to — the
// /join-team Referral Partner programme: this page is for the
// professional themselves, /join-team is for field associates who onboard
// professionals on someone else's behalf.

import Link from 'next/link';
import {
  Sparkles,
  Briefcase,
  UserCheck,
  IndianRupee,
  CalendarClock,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import LeadGenFloater from '@/components/common/LeadGenFloater';
import JsonLd, { breadcrumb, webPage } from '@/components/seo/JsonLd';

const PAGE_TITLE = 'For Professionals: Grow Your Practice on Pro Firmo';
const PAGE_DESC =
  'Verified tax, GST, CA, CS, and documentation professionals — get matched with high-intent clients across India. AI-screened consultation requests, no cold outreach, transparent platform fees.';

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESC,
  keywords:
    'consultation platform CA, online tax consultant India, GST consultant platform, freelance CA, online CA practice, earn online tax consultant',
  alternates: { canonical: '/for-professionals' },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESC,
    url: '/for-professionals',
    siteName: 'Pro Firmo',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: PAGE_TITLE, description: PAGE_DESC },
};

const JSON_LD = [
  webPage({
    url: '/for-professionals',
    name: PAGE_TITLE,
    description: PAGE_DESC,
  }),
  breadcrumb([
    { name: 'Home', url: '/' },
    { name: 'For Professionals', url: '/for-professionals' },
  ]),
];

const VALUE_PROPS = [
  {
    icon: Sparkles,
    title: 'AI-screened leads',
    body:
      'Clients describe their case to AI first; we send only matched, qualified requests to your inbox. No tyre-kickers, no time wasted.',
  },
  {
    icon: IndianRupee,
    title: 'You set your rate',
    body:
      'Per-minute consultation rate, per-engagement quote, or retainers — your call. Pro Firmo charges a transparent platform fee on completed bookings.',
  },
  {
    icon: CalendarClock,
    title: 'Your schedule, your slots',
    body:
      'Mark availability by hour. Reschedule cleanly. Online or in-person — your call per booking.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified profile = trust',
    body:
      'We verify your identity, credentials, and registration. Verified-badge profiles convert significantly better.',
  },
];

const STEPS = [
  'Sign up free with your name, email, phone — verify your number via OTP.',
  'Complete your profile: practice areas, languages, cities served, registration number, sample work.',
  'Upload identity + credential documents — verification within 48-72 hours.',
  'Once approved, your listing is live and you start receiving matched consultation requests.',
  'Conduct consultations on the platform, get reviewed by clients, get paid on a settled schedule.',
];

const FIT = [
  {
    title: 'Chartered Accountants (CAs)',
    body:
      'ITR filing, GST advisory, tax notices, audit, financial planning. Strong demand year-round, peaks in June-July and October.',
  },
  {
    title: 'GST Practitioners & Tax Consultants',
    body:
      'GST registration, returns, notices, refunds. The single highest-volume category on Pro Firmo.',
  },
  {
    title: 'Company Secretaries (CSs)',
    body:
      'Incorporation, ROC compliance, ESOP, fundraise documentation, FEMA reporting.',
  },
  {
    title: 'Documentation experts',
    body:
      'Rental agreements, contract drafting, business contracts, NDAs. Quick turnaround, high frequency.',
  },
  {
    title: 'IP attorneys / Trademark practitioners',
    body:
      'TM-A filings, objection responses, oppositions. India\'s startup pipeline drives steady demand.',
  },
];

const FAQ = [
  [
    'Is Pro Firmo free to sign up for professionals?',
    'Yes — signup, profile verification, and listing are all free. We charge a transparent platform fee on completed bookings only. No subscription required.',
  ],
  [
    'How many consultation requests will I receive?',
    'Varies by your category, city, languages, and rating. Active GST consultants in metros typically see 8-20 matched requests per week; tax-notice specialists see fewer but higher-value requests.',
  ],
  [
    'How fast does verification take?',
    '48-72 hours for standard documents. Bar Council enrolment, CA / CS membership, GSTIN are verified directly with the issuing body.',
  ],
  [
    'How are clients matched to me?',
    'Our AI screens the client\'s case description, then matches against your declared practice areas, cities, languages, and availability. You see only requests that fit.',
  ],
  [
    'How do payouts work?',
    'Settled monthly to your bank account. You see every booking, every fee, and the platform breakdown in your dashboard. Pro Firmo is GST-compliant; you receive proper invoices.',
  ],
];

export default function ForProfessionalsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <JsonLd data={JSON_LD} />
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
          <div className="pointer-events-none absolute -right-32 top-0 h-72 w-72 rounded-full bg-amber-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -left-32 bottom-0 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-200">
              For verified professionals
            </span>
            <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-5xl">
              Grow your practice
              <br />
              with matched consultation requests.
            </h1>
            <p className="mt-4 max-w-3xl text-base text-slate-300 sm:text-lg">
              Pro Firmo connects tax, GST, CA, CS, and documentation
              professionals with clients who described their case to AI
              first. No cold outreach. No tyre-kickers. You set your rate;
              we send you the matched requests.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup?role=professional"
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-500/30 transition hover:bg-amber-400"
              >
                <UserCheck size={16} />
                Sign up free
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
              >
                See pricing & platform fees
              </Link>
            </div>
          </div>
        </section>

        {/* Value props */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {VALUE_PROPS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Icon size={18} />
                </span>
                <h2 className="mt-4 text-sm font-semibold text-slate-900">
                  {title}
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Fit */}
        <section className="bg-slate-100/60 py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-slate-900">
              Who&apos;s a good fit
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Pro Firmo focuses on tax, GST, CA, CS, and documentation
              professionals. Demand patterns by category:
            </p>
            <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FIT.map((f) => (
                <li
                  key={f.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex items-center gap-2">
                    <Briefcase size={14} className="text-teal-600" />
                    <h3 className="text-sm font-semibold text-slate-900">
                      {f.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    {f.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Steps */}
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900">How onboarding works</h2>
          <p className="mt-2 text-sm text-slate-600">Five steps, 48–72 hours from signup to live profile.</p>
          <ol className="mt-8 space-y-4">
            {STEPS.map((step, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-slate-700">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 pb-12 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900">FAQs</h2>
          <dl className="mt-6 space-y-4">
            {FAQ.map(([q, a]) => (
              <div key={q} className="rounded-2xl border border-slate-200 bg-white p-5">
                <dt className="text-sm font-semibold text-slate-900">{q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-slate-700">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Cross-link to /join-team */}
        <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
              Not a professional yourself?
            </p>
            <p className="mt-2 text-sm leading-relaxed text-amber-900">
              If you want to refer or onboard professionals on behalf of
              someone else, our{' '}
              <Link
                href="/join-team"
                className="font-semibold underline underline-offset-2"
              >
                Referral Partner programme
              </Link>{' '}
              pays a fixed commission per approved onboarding. No
              registration required — just a phone number and an OTP.
            </p>
            <Link
              href="/join-team"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-700 hover:underline"
            >
              Read about the Referral Partner programme
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <LeadGenFloater source="for-professionals" />
    </div>
  );
}
