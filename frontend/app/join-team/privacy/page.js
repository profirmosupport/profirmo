import EmployeeHeader from '@/components/employee/EmployeeHeader';
import Footer from '@/components/common/Footer';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Employee Privacy Policy · Profirmo',
};

const SECTIONS = [
  {
    title: 'Data we collect',
    body: 'When you sign up as an employee we collect your full name, email address, phone number and the IP address of the device you signed up from. We also store the timestamp of your terms acceptance. Once you onboard professionals we record every professional you submit, the onboarding timestamp, and your employee code on each of those records.',
  },
  {
    title: 'Why we verify your phone',
    body: 'We send a one-time password (OTP) to your phone via SMS to confirm you control the number. The phone number doubles as your employee code, so verifying it prevents one person from creating multiple employee identities and protects your earned commission.',
  },
  {
    title: 'How we use onboarding activity',
    body: 'We track every professional you onboard so we can credit commission when the admin approves them. Aggregated metrics (total onboarded, approved, rejected) appear on your dashboard and in the admin\'s employee listing. We do not share your individual onboarding numbers with other employees.',
  },
  {
    title: 'How we use payout records',
    body: 'Every commission credit, payout request, and payout decision is stored against your employee record so you can audit your earnings and so the admin can resolve disputes. Payout records are retained for as long as legally required.',
  },
  {
    title: 'Professional data',
    body: 'The professional data you submit during onboarding becomes part of the professional\'s Profirmo profile, governed by the platform-wide Privacy Policy. We may contact the professional directly to verify the details you submitted.',
  },
  {
    title: 'Security & access',
    body: 'Your employee account is protected by an OTP-verified password and / or login OTP. Passwords are stored as bcrypt hashes, never in plain text. Only the Profirmo admin team has access to employee records and only for legitimate platform-operation purposes.',
  },
  {
    title: 'Your rights',
    body: 'You can request a copy of your employee record, request correction of inaccurate details, or request deletion of your account. Some records (payout history, regulatory records) may be retained beyond account deletion as legally required.',
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
            Employee Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            What we collect when you sign up as an employee, why we
            collect it, and how it&apos;s used.
          </p>
          <ol className="mt-10 space-y-8">
            {SECTIONS.map((s, i) => (
              <li key={s.title}>
                <h2 className="text-base font-semibold text-slate-900">
                  {i + 1}. {s.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </main>
      <Footer />
    </div>
  );
}
