'use client';

// /join-team — Employee module landing.
// Pitches the field-agent role and surfaces the two CTAs:
//   1. Sign up as employee
//   2. Log in (already an employee)

import Link from 'next/link';
import {
  UserPlus,
  LogIn,
  CheckCircle2,
  Users,
  IndianRupee,
  ShieldCheck,
} from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';

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
    body: 'Request payout from your available balance any time above the platform minimum. Admin approves and marks it paid.',
  },
];

const STEPS = [
  'Sign up with your name, email and phone — we send a one-time OTP.',
  'Verify the OTP and set a password (or use OTP every time, your call).',
  'Open the Employee Dashboard and start onboarding professionals.',
  'When the admin approves a professional you onboarded, commission is credited automatically.',
  'Request a payout from your available balance — admin processes it.',
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
              Profirmo · Field team
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
              Bring real legal & tax pros onto Profirmo —
              <br />
              and get paid for every approved onboarding.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
              The Profirmo Employee Portal is for field agents who refer and
              onboard verified consultants. Sign up in a minute, onboard
              professionals from the same form they use to register, and
              earn a fixed commission for every one the admin approves.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/join-team/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-500/30 transition hover:bg-amber-400"
              >
                <UserPlus size={16} />
                Sign up as employee
              </Link>
              <Link
                href="/join-team/login"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
              >
                <LogIn size={16} />
                I already have an account
              </Link>
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

        {/* Fine print */}
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm leading-relaxed text-amber-900">
                <p className="font-semibold">Commission is approval-gated.</p>
                <p className="mt-1">
                  You earn commission only on professionals that the admin
                  approves. Pending or rejected onboardings don&apos;t count.
                  Fake or duplicate entries will not be approved and may
                  lead to account block.
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
