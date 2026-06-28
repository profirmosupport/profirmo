import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import EmployeeHeader from '@/components/employee/EmployeeHeader';
import Footer from '@/components/common/Footer';

export const metadata = {
  title: 'Onboarding Guide · Profirmo Referral Partners',
  description:
    'Step-by-step reference for the Profirmo Referral Partner programme — onboarding flow, required info, professional-consent confirmation, commission rules, clawback triggers, payout SLA, and account responsibilities.',
  alternates: { canonical: '/join-team/guide' },
};

const SECTIONS = [
  {
    title: 'How professional onboarding works',
    items: [
      'Open the dashboard and tap "Onboard professional".',
      'Fill in the professional\'s name, email, phone and a few professional details.',
      'Tick the consent checkbox confirming the professional has agreed to be contacted by Profirmo for verification.',
      'Submit — the professional is added in PENDING APPROVAL status. Profirmo admin reviews the submission.',
      'When the admin approves, the professional is activated AND commission is credited to you automatically.',
      'When the admin rejects, the rejection reason appears next to the row on your dashboard. Commission is NOT credited.',
    ],
  },
  {
    title: 'What information is required',
    items: [
      'Name, email, phone (must be valid and not used by an existing Profirmo account)',
      'Professional type — Legal Consultant or Tax Consultant',
      'Short bio, years of experience (minimum 5), consultation fee',
      'License / registration number where applicable',
      'Address / chamber location (helps verification)',
      'Registration certificate or card (Bar Council, CA, or equivalent ID upload)',
    ],
  },
  {
    title: 'Confirming professional consent',
    items: [
      'Only onboard professionals who have personally agreed to be contacted by Profirmo. Submission without consent is a breach of these terms.',
      'On the onboarding form, tick the consent checkbox: "I confirm that the professional has agreed to be contacted by Profirmo regarding registration."',
      'Profirmo may contact the professional directly to verify the details you submitted. If the professional denies consent, the onboarding will be rejected and may count as a misuse.',
    ],
  },
  {
    title: 'When commission is counted',
    items: [
      'Commission is credited only after admin marks the professional APPROVED.',
      'Pending or rejected professionals do NOT earn commission.',
      'Re-approval after a clawback updates the same commission row — you are never paid twice for the same professional.',
      'Commission amount comes from the platform setting at the time of approval.',
    ],
  },
  {
    title: 'Commission clawback — when it applies',
    items: [
      'Fraudulent submissions or any form of misrepresentation about the professional.',
      'Duplicate professionals — the same person was already listed on Profirmo before your submission.',
      'Verification failures — the professional\'s identity, registration, or credential verification fails after the initial approval.',
      'Self-referrals or onboarding immediate family / household / entities you control purely for commission.',
      'Clawback applies up to 90 days after the original approval. The amount is debited from your available balance; a negative balance is settled against future commission.',
    ],
  },
  {
    title: 'How payouts work',
    items: [
      'Your dashboard tracks earned, paid, pending, and available balance separately.',
      'A payout request reserves the amount from your available balance until admin resolves it.',
      'Minimum and maximum payout amounts are configured by admin; the dashboard always shows the current values.',
      'You can have one in-flight request at a time. Cancel the existing pending one to submit a new amount.',
      'Approved payout requests are normally processed within 7 business days (excluding bank / gateway settlement time).',
      'Once admin marks a request paid, your available balance drops by that amount; the request appears under "Paid".',
    ],
  },
  {
    title: 'Referral Partner responsibilities',
    items: [
      'Submit accurate, current, verifiable details for every professional.',
      'Do not submit duplicate, fake, or low-quality leads — they will be rejected and may lead to account block.',
      'Do not onboard yourself, immediate family, household members, or entities you control solely for commission. This is treated as fraud (see clawback section).',
      'Do not share your account credentials. Your phone number is your partner code and identifies every onboarding to you.',
      'Respect the professional\'s consent — only onboard people who have agreed to join Profirmo through you.',
    ],
  },
  {
    title: 'Approval & payout rules — quick reference',
    items: [
      'Commission per approved professional: configured by admin.',
      'Minimum payout amount: configured by admin (dashboard shows current value).',
      'Maximum payout amount per request: configured by admin (dashboard shows current value).',
      'One pending payout request at a time per Referral Partner.',
      'Payout processing SLA: 7 business days from admin approval.',
      'Admin can approve, reject, hold, or mark a payout paid at their discretion (subject to the dispute-resolution process in the terms).',
    ],
  },
];

export default function OnboardingGuidePage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <EmployeeHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <Link
            href="/join-team/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={14} />
            Back to dashboard
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-slate-900">
            Onboarding Guide
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Step-by-step reference for the Profirmo Referral Partner
            programme.
          </p>

          <div className="mt-8 space-y-8">
            {SECTIONS.map((s) => (
              <section
                key={s.title}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <h2 className="text-base font-semibold text-slate-900">
                  {s.title}
                </h2>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
                  {s.items.map((it, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {/* Internal links between the four partner-portal pages */}
          <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Related
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-2 text-sm text-amber-700 sm:grid-cols-3">
              <li>
                <Link
                  href="/join-team"
                  className="hover:underline underline-offset-2"
                >
                  Referral Partner overview
                </Link>
              </li>
              <li>
                <Link
                  href="/join-team/terms"
                  className="hover:underline underline-offset-2"
                >
                  Terms &amp; conditions
                </Link>
              </li>
              <li>
                <Link
                  href="/join-team/privacy"
                  className="hover:underline underline-offset-2"
                >
                  Privacy policy
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
