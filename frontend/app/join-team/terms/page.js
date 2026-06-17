import EmployeeHeader from '@/components/employee/EmployeeHeader';
import Footer from '@/components/common/Footer';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Referral Partner Terms & Conditions · Profirmo',
  description:
    'Legally binding terms for Profirmo Referral Partners — scope, commission rules, payout SLA, anti-fraud, clawbacks, dispute resolution, and governing law.',
  alternates: { canonical: '/join-team/terms' },
};

const SECTIONS = [
  {
    title: 'Scope of the Referral Partner role',
    body: 'Referral Partners are responsible solely for onboarding new legal and tax consultants to the Profirmo platform. Referral Partners do not represent Profirmo for any other purpose and have no authority to negotiate fees, make legal promises, or commit Profirmo to any service beyond the documented onboarding flow.',
  },
  {
    title: 'Independent contractor relationship',
    body: 'A Referral Partner is engaged as an independent contractor and not as an employee, joint venturer, agent, or partner of Profirmo. Nothing in these terms creates an employer–employee relationship. Referral Partners are solely responsible for their own income tax, GST (where applicable), and any other statutory obligations arising from the commission they earn.',
  },
  {
    title: 'Genuine submissions only',
    body: 'Referral Partners must submit accurate, current, and verifiable details for every professional they onboard. Fake, duplicate, manipulated, or otherwise invalid entries will not be approved, will not earn commission, and may lead to account block.',
  },
  {
    title: 'Self-referral and anti-fraud',
    body: 'Referral Partners may not onboard themselves, their immediate family members, members of the same household, or any entity that they control, manage, or have a financial interest in, solely for the purpose of earning commission. Profirmo may at any time audit onboarded professionals against the Referral Partner\'s declared identity, address, or PAN to detect self-referrals. Confirmed self-referrals or any other form of commission fraud are grounds for immediate account block, reversal of all earned and unpaid commission, and may be referred to law enforcement.',
  },
  {
    title: 'Commission is approval-gated',
    body: 'Commission is payable strictly on professionals that the Profirmo admin team approves after verification. Pending or rejected onboardings do not earn commission. The per-professional commission amount is configured by Profirmo and may change at any time. Commission earned before a change is unaffected; commission for onboardings approved after a change uses the new rate.',
  },
  {
    title: 'Commission clawback',
    body: 'Profirmo may reverse a previously credited commission ("clawback") if, within 90 days of approval, any of the following is discovered: (a) the onboarding was found to be fraudulent or self-referred; (b) the professional was a duplicate of an already-listed Profirmo account; (c) the professional\'s identity, registration, or credential verification subsequently failed; or (d) the professional was suspended or removed from Profirmo for a material breach attributable to false information in the onboarding. A clawback debits the amount from the Referral Partner\'s available balance; if the balance is insufficient, the negative balance is settled against future commission until cleared.',
  },
  {
    title: 'Payout timeline and rules',
    body: 'Payout requests must respect the minimum and maximum amounts configured by the admin and may not exceed the available approved-commission balance. Approved payout requests are normally processed within 7 (seven) business days from the date of approval; processing time excludes payment-gateway / bank settlement time, which is governed by the receiving institution. Payouts are made via the payment method selected by the Referral Partner. Once a payout is marked paid, the amount is debited from the Referral Partner\'s available balance.',
  },
  {
    title: 'Admin discretion',
    body: 'Profirmo retains the absolute right to approve, reject, suspend, block, or remove any professional submitted by a Referral Partner. Profirmo retains the absolute right to approve, hold, reject, or process any Referral Partner payout request. Decisions are made on legitimate platform-operation grounds and may be challenged via the dispute-resolution clause below.',
  },
  {
    title: 'Misuse and abuse',
    body: 'Referral Partners must not misuse the Profirmo platform, submit false information, harass professionals or clients, attempt to manipulate the commission system, or share their account credentials with anyone. Confirmed abuse will result in account block and reversal of any earned but unpaid commission.',
  },
  {
    title: 'Dispute resolution',
    body: 'A Referral Partner who disagrees with an admin decision (rejection of an onboarding, hold or rejection of a payout, application of a clawback, or account block) may submit a dispute by emailing support@profirmo.com within 30 days of the decision, including the relevant professional id / payout id and the reason for the dispute. Profirmo will acknowledge receipt within 3 business days and aim to provide a final response within 15 business days. These terms and any dispute arising under them are governed by the laws of India. Subject to good-faith email-based resolution, the courts at New Delhi shall have exclusive jurisdiction over any dispute.',
  },
  {
    title: 'Updates to these terms',
    body: 'Profirmo may amend these terms at any time. Material changes (commission rates, clawback rules, dispute process, governing law) will be communicated by email or in-app notice at least 7 days before they take effect. Continued use of the Referral Partner Portal after a change indicates acceptance of the updated terms.',
  },
];

export default function EmployeeTermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <EmployeeHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <Link
            href="/join-team"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={14} />
            Back to overview
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-slate-900">
            Referral Partner Terms &amp; Conditions
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            By signing up to the Profirmo Referral Partner Portal you agree
            to the terms below. They govern the Referral Partner–Profirmo
            relationship and sit alongside the platform-wide{' '}
            <Link
              href="/terms"
              className="font-medium text-amber-700 underline-offset-2 hover:underline"
            >
              Terms of Service
            </Link>
            .
          </p>
          <ol className="mt-10 space-y-8">
            {SECTIONS.map((s, i) => (
              <li key={s.title}>
                <h2 className="text-base font-semibold text-slate-900">
                  {i + 1}. {s.title}
                </h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>

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
                  href="/join-team/guide"
                  className="hover:underline underline-offset-2"
                >
                  Onboarding guide
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
