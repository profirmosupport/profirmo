import EmployeeHeader from '@/components/employee/EmployeeHeader';
import Footer from '@/components/common/Footer';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Employee Terms & Conditions · Profirmo',
};

const SECTIONS = [
  {
    title: 'Scope of the employee role',
    body: 'Employees are responsible solely for onboarding new legal and tax consultants to the Profirmo platform. Employees do not represent Profirmo for any other purpose and do not have authority to negotiate fees, make legal promises, or commit Profirmo to any service beyond the documented onboarding flow.',
  },
  {
    title: 'Genuine submissions only',
    body: 'Employees must submit accurate, current, and verifiable details for every professional they onboard. Fake, duplicate, manipulated, or otherwise invalid entries will not be approved, will not earn commission, and may lead to account block.',
  },
  {
    title: 'Commission is approval-gated',
    body: 'Commission is payable strictly on professionals that the Profirmo admin team approves after verification. Pending or rejected onboardings do not earn commission. The per-professional commission amount is configured by Profirmo and may change at any time. Commission earned before a change is unaffected; commission for onboardings approved after a change uses the new rate.',
  },
  {
    title: 'Admin discretion',
    body: 'Profirmo retains the absolute right to approve, reject, suspend, block, or remove any professional submitted by an employee. Profirmo retains the absolute right to approve, hold, reject, or process any employee payout request. Decisions are final and at Profirmo\'s sole discretion.',
  },
  {
    title: 'Payout rules',
    body: 'Payout requests must respect the minimum and maximum amounts configured by the admin and may not exceed the available approved-commission balance. Payouts are processed by the admin team via the payment method selected by the employee. Once a payout is marked paid, the amount is debited from the employee\'s available balance.',
  },
  {
    title: 'Misuse and abuse',
    body: 'Employees must not misuse the Profirmo platform, submit false information, harass professionals or clients, attempt to manipulate the commission system, or share their employee account with anyone. Confirmed abuse will result in account block and reversal of any earned but unpaid commission.',
  },
  {
    title: 'Updates to these terms',
    body: 'Profirmo may amend these terms at any time. Continued use of the Employee Portal after a change indicates acceptance of the updated terms.',
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
            Employee Terms &amp; Conditions
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            By signing up to the Employee Portal you agree to the terms
            below. They govern the employee–Profirmo relationship and
            sit alongside the platform-wide Terms of Service.
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
