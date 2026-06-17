import EmployeeHeader from '@/components/employee/EmployeeHeader';
import Footer from '@/components/common/Footer';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Referral Partner Privacy Policy · Profirmo',
  description:
    'How Profirmo collects, uses, retains, and protects Referral Partner data — phone verification, onboarding activity, payout records, cookies, cross-border transfers, retention periods, and how to exercise your rights.',
  alternates: { canonical: '/join-team/privacy' },
};

const SECTIONS = [
  {
    title: 'Data we collect',
    body: 'When you sign up as a Referral Partner we collect your full name, email address, phone number, and the IP address of the device you signed up from. We also store the timestamp of your terms acceptance. Once you onboard professionals we record every professional you submit, the onboarding timestamp, and your partner code on each of those records.',
  },
  {
    title: 'Why we verify your phone',
    body: 'We send a one-time password (OTP) to your phone via SMS to confirm you control the number. The phone number doubles as your partner code, so verifying it prevents one person from creating multiple Referral Partner identities and protects your earned commission.',
  },
  {
    title: 'How we use onboarding activity',
    body: 'We track every professional you onboard so we can credit commission when the admin approves them. Aggregated metrics (total onboarded, approved, rejected) appear on your dashboard and in the admin\'s partner listing. We do not share your individual onboarding numbers with other Referral Partners.',
  },
  {
    title: 'How we use payout records',
    body: 'Every commission credit, payout request, and payout decision is stored against your partner record so you can audit your earnings and so the admin can resolve disputes.',
  },
  {
    title: 'Professional data',
    body: 'The professional data you submit during onboarding becomes part of the professional\'s Profirmo profile, governed by the platform-wide Privacy Policy. We may contact the professional directly to verify the details you submitted. You must confirm at the point of submission that the professional has consented to be contacted by Profirmo for verification.',
  },
  {
    title: 'Cookies, analytics & device data',
    body: 'The Referral Partner Portal sets a session cookie for your login and uses standard analytics (Google Analytics) to measure traffic and improve the product. Analytics data is aggregated and pseudonymous; it includes device, browser, and page-view information but no payout-record content. You can disable cookies in your browser, but the portal requires the session cookie to keep you signed in.',
  },
  {
    title: 'Cross-border processing',
    body: 'Profirmo\'s infrastructure is hosted in India (AWS Mumbai region) by default. Some sub-processors used for email delivery, SMS OTP, and analytics may process limited operational data (e.g., your email address, phone number, IP address) outside India, in jurisdictions including the United States and the European Union. We rely on the vendors\' contractual safeguards for any such transfer.',
  },
  {
    title: 'Data retention',
    body: 'Active Referral Partner records are retained for as long as the account is active. After account closure, identifying personal data (name, email, phone) is retained for 24 months for fraud-prevention and audit purposes, and then deleted or anonymised. Commission, payout, and tax-related records are retained for 8 years to meet statutory record-keeping obligations under Indian law. Onboarded-professional records that have become part of the Profirmo marketplace remain governed by the platform-wide Privacy Policy and may be retained for the lifetime of the professional\'s Profirmo profile.',
  },
  {
    title: 'Security & access',
    body: 'Your account is protected by an OTP-verified password and / or login OTP. Passwords are stored as bcrypt hashes, never in plain text. Only the Profirmo admin team has access to Referral Partner records, and only for legitimate platform-operation purposes.',
  },
  {
    title: 'Your rights & contact',
    body:
      'You can request a copy of your record, request correction of inaccurate details, or request deletion of your account at any time. Some records (payout history, regulatory records) may be retained beyond account deletion as set out above. To exercise any of these rights, or for any privacy-related question, email privacy@profirmo.com from the email address registered to your account. We aim to respond within 15 business days.',
  },
];

export default function EmployeePrivacyPage() {
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
            Referral Partner Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            What we collect when you sign up as a Profirmo Referral Partner,
            why we collect it, how long we keep it, and how to exercise
            your rights.
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
                  href="/join-team/terms"
                  className="hover:underline underline-offset-2"
                >
                  Terms &amp; conditions
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
