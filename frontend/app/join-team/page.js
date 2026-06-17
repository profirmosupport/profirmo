// /join-team — Referral Partner module landing.
// Pitches the referral-partner role and surfaces the two CTAs:
//   1. Sign up as Referral Partner
//   2. Log in (already a Referral Partner)
//
// Server component so we can export `metadata`. The page has no
// client state — Header / Footer / Link work fine from a server
// component.

import Link from 'next/link';
import {
  UserPlus,
  LogIn,
  CheckCircle2,
  Users,
  IndianRupee,
  ShieldCheck,
  BookOpen,
  FileText,
  Lock,
  LayoutDashboard,
  ArrowRight,
} from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';

export const metadata = {
  title: 'Become a Profirmo Referral Partner · Earn for every approved onboarding',
  description:
    'Join the Profirmo Referral Partner programme. Refer verified legal & tax consultants, earn a fixed commission for every admin-approved onboarding, and track payouts on your dashboard.',
  alternates: { canonical: '/join-team' },
};

const PERKS = [
  {
    icon: IndianRupee,
    title: 'Earn for every approved professional',
    body: 'Onboard verified legal & tax consultants. Each admin-approved professional adds a fixed commission to your balance.',
  },
  {
    icon: Users,
    title: 'Own dashboard, own tracker',
    body: 'Live status of every professional you onboarded — pending review, approved, or rejected — plus earnings to date.',
  },
  {
    icon: ShieldCheck,
    title: 'Transparent payouts',
    body: 'Request payout from your available balance any time above the platform minimum. Admin processes approved payouts within 7 business days.',
  },
];

// Every page inside the Referral Partner portal, surfaced as one
// icon grid near the bottom of /join-team so a visitor (or a
// returning partner) can jump directly to whichever surface they
// need without having to discover it via the dashboard header.
const PORTAL_LINKS = [
  {
    href: '/join-team/signup',
    icon: UserPlus,
    title: 'Sign up',
    body: 'Create a Referral Partner account in under a minute.',
    tint: 'amber',
  },
  {
    href: '/join-team/login',
    icon: LogIn,
    title: 'Log in',
    body: 'Already a partner? Sign in with password or OTP.',
    tint: 'slate',
  },
  {
    href: '/join-team/dashboard',
    icon: LayoutDashboard,
    title: 'Partner dashboard',
    body: 'Track onboardings, commission, and payouts in real time.',
    tint: 'emerald',
  },
  {
    href: '/join-team/guide',
    icon: BookOpen,
    title: 'Onboarding guide',
    body: 'Step-by-step reference for submitting and getting paid.',
    tint: 'teal',
  },
  {
    href: '/join-team/terms',
    icon: FileText,
    title: 'Terms & conditions',
    body: 'Commission, clawback, payout SLA, dispute resolution.',
    tint: 'slate',
  },
  {
    href: '/join-team/privacy',
    icon: Lock,
    title: 'Privacy policy',
    body: 'Data we collect, retention, cross-border, your rights.',
    tint: 'sky',
  },
];

const STEPS = [
  'Sign up with your name, email and phone — we send a one-time OTP.',
  'Verify the OTP and set a password (or use OTP every time, your call).',
  'Open the Referral Partner Dashboard and start onboarding professionals.',
  'When the admin approves a professional you onboarded, commission is credited automatically.',
  'Request a payout from your available balance — admin processes approved requests within 7 business days.',
];

export default function JoinTeamLanding() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
          <div className="pointer-events-none absolute -right-32 top-0 h-72 w-72 rounded-full bg-amber-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -left-32 bottom-0 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-200">
              Profirmo · Referral Partner programme
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
              Bring real legal &amp; tax pros onto Profirmo —
              <br />
              and get paid for every approved onboarding.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
              The Profirmo Referral Partner Portal is for field associates
              who refer and onboard verified consultants. Sign up in a
              minute, onboard professionals from the same form they use to
              register, and earn a fixed commission for every one the admin
              approves.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/join-team/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-500/30 transition hover:bg-amber-400"
              >
                <UserPlus size={16} />
                Sign up as Referral Partner
              </Link>
              <Link
                href="/join-team/login"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
              >
                <LogIn size={16} />
                I already have an account
              </Link>
            </div>

            {/* Read-first buttons — the binding documents and the
                operational guide a partner should read before signing
                up. Surfaced at the top of the hero (rather than buried
                in the bottom fine-print) so they're impossible to miss. */}
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-200/80">
                Read before signing up
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href="/join-team/terms"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white backdrop-blur transition hover:border-amber-300/60 hover:bg-amber-300/10 hover:text-amber-100"
                >
                  <FileText size={14} />
                  Referral Partner Terms
                </Link>
                <Link
                  href="/join-team/privacy"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white backdrop-blur transition hover:border-amber-300/60 hover:bg-amber-300/10 hover:text-amber-100"
                >
                  <Lock size={14} />
                  Privacy Policy
                </Link>
                <Link
                  href="/join-team/guide"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white backdrop-blur transition hover:border-amber-300/60 hover:bg-amber-300/10 hover:text-amber-100"
                >
                  <BookOpen size={14} />
                  Onboarding Guide
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Perks */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {PERKS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Icon size={18} />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="bg-slate-100/60 py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-slate-900">
              How it works
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Five steps from signup to payout.
            </p>
            <ol className="mt-8 space-y-4">
              {STEPS.map((step, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-slate-700">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Portal links — every page inside the Referral Partner module
            surfaced as an icon card so a visitor (or returning partner)
            can jump directly without hunting through nav menus. */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Everything in the Referral Partner portal
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                One-click access to sign-up, sign-in, the dashboard, the
                onboarding guide, and the binding legal documents.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PORTAL_LINKS.map(({ href, icon: Icon, title, body, tint }) => {
              const tints = {
                amber: 'bg-amber-100 text-amber-700',
                slate: 'bg-slate-100 text-slate-700',
                emerald: 'bg-emerald-100 text-emerald-700',
                teal: 'bg-teal-100 text-teal-700',
                sky: 'bg-sky-100 text-sky-700',
              };
              return (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      tints[tint] || tints.slate
                    }`}
                  >
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 text-sm font-semibold text-slate-900">
                      {title}
                      <ArrowRight
                        size={14}
                        className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-amber-600"
                      />
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {body}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Fine print */}
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm leading-relaxed text-amber-900">
                <p className="font-semibold">Commission is approval-gated.</p>
                <p className="mt-1">
                  You earn commission only on professionals that the admin
                  approves. Pending or rejected onboardings don&apos;t
                  count. Fake, duplicate, or self-referred entries will not
                  be approved and may lead to account block and commission
                  clawback.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
