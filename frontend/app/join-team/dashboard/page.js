'use client';

// /join-team/dashboard — Employee dashboard.
// Summary cards · onboarded professionals list · commission history ·
// payout request modal · payout history. Mirrors the brief's
// dashboard section. All reads + the payout request hit
// /api/employee/*.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  IndianRupee,
  Wallet,
  Loader2,
  LogOut,
  PlusCircle,
  AlertCircle,
  RefreshCw,
  Trophy,
  Star,
  TrendingUp,
  ShieldCheck,
  BriefcaseBusiness,
  Mail,
  FileBadge2,
} from 'lucide-react';
import EmployeeHeader from '@/components/employee/EmployeeHeader';
import Footer from '@/components/common/Footer';
import {
  request,
  employeeGetMe,
  clearEmployeeSession,
} from '@/services/employeeAuthService';

function rupees(n) {
  const v = Number(n) || 0;
  return `₹${v.toLocaleString('en-IN')}`;
}

const STATUS_VARIANT = {
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-800',
};

const PAYOUT_VARIANT = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
  'on-hold': 'bg-violet-100 text-violet-800',
  cancelled: 'bg-slate-100 text-slate-600',
};

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pros, setPros] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payoutOpen, setPayoutOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [meRes, sum, prosList, comms, payoutsList] = await Promise.all([
        employeeGetMe(),
        request('/api/employee/dashboard/summary', { auth: true }),
        request('/api/employee/professionals', { auth: true }),
        request('/api/employee/commissions', { auth: true }),
        request('/api/employee/payouts', { auth: true }),
      ]);
      setMe(meRes);
      setSummary(sum);
      setPros(Array.isArray(prosList) ? prosList : []);
      setCommissions(Array.isArray(comms) ? comms : []);
      setPayouts(Array.isArray(payoutsList) ? payoutsList : []);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        // Wipe the stale token BEFORE redirecting. Without this, the
        // login page's "already signed in" guard reads the dead token
        // from localStorage and bounces back here — infinite flicker.
        clearEmployeeSession();
        router.replace('/join-team/login');
        return;
      }
      setError(err.message || 'Could not load your dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function signOut() {
    clearEmployeeSession();
    router.replace('/join-team');
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <EmployeeHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Welcome{me ? `, ${(me.name || '').split(' ')[0]}` : ''}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Employee code:{' '}
                <span className="font-mono font-semibold text-slate-800">
                  {me?.employeeCode || '—'}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-amber-300 hover:text-amber-700 disabled:opacity-60"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <Link
                href="/join-team/onboard"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-amber-700"
              >
                <PlusCircle size={14} />
                Onboard professional
              </Link>
              {/* Sign-out + employee identity now live in EmployeeHeader. */}
            </div>
          </div>

          {error ? (
            <div className="mt-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {error}
            </div>
          ) : null}

          {loading && !summary ? (
            <div className="mt-10 flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard…
            </div>
          ) : (
            <>
              {/* Three rules a candidate professional must meet before an
                  admin will approve them. Surfacing this on the dashboard so
                  every employee onboards with the right expectations. */}
              <EligibilityRules />

              {/* Single source of truth for the per-approval rate. The
                  Employee-of-the-Month cards used to repeat this number —
                  it now lives only here. */}
              <PerApprovalBanner
                perListing={summary?.settings?.commission ?? 0}
                multiplier={summary?.settings?.topPerformerMultiplier ?? 1}
              />

              {/* Employees of the Month — static recognition cards. */}
              <FeaturedEmployees
                perListing={summary?.settings?.commission ?? 0}
                multiplier={summary?.settings?.topPerformerMultiplier ?? 1}
              />

              {/* Stats grid */}
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard
                  label="Total onboarded"
                  value={summary?.professionals?.total ?? 0}
                  icon={Users}
                  tint="slate"
                />
                <StatCard
                  label="Pending approval"
                  value={summary?.professionals?.pending ?? 0}
                  icon={Clock}
                  tint="amber"
                />
                <StatCard
                  label="Approved"
                  value={summary?.professionals?.approved ?? 0}
                  icon={CheckCircle2}
                  tint="emerald"
                />
                <StatCard
                  label="Rejected"
                  value={summary?.professionals?.rejected ?? 0}
                  icon={XCircle}
                  tint="rose"
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard
                  label="Commission earned"
                  value={rupees(summary?.earned)}
                  icon={IndianRupee}
                  tint="emerald"
                />
                <StatCard
                  label="Paid out"
                  value={rupees(summary?.paid)}
                  icon={Wallet}
                  tint="slate"
                />
                <StatCard
                  label="Payout pending"
                  value={rupees(summary?.pendingPayout)}
                  icon={Clock}
                  tint="amber"
                />
                <StatCard
                  label="Available balance"
                  value={rupees(summary?.availablePayout)}
                  icon={IndianRupee}
                  tint="amber"
                  emphasised
                />
              </div>

              {/* Payout request button */}
              <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
                <div className="text-sm text-amber-900">
                  Minimum payout {rupees(summary?.settings?.minPayout)} ·
                  Maximum {rupees(summary?.settings?.maxPayout)} per request.
                </div>
                <button
                  type="button"
                  onClick={() => setPayoutOpen(true)}
                  disabled={
                    !summary ||
                    Number(summary.availablePayout) <
                      Number(summary.settings?.minPayout || 0)
                  }
                  className="ml-auto inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Request payout
                </button>
              </div>

              {/* Onboarded professionals */}
              <Section title={`My onboarded professionals (${pros.length})`}>
                {pros.length === 0 ? (
                  <Empty
                    title="No professionals yet"
                    body="Use Onboard professional to submit your first lead. Commission is credited once admin approves."
                  />
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Name</th>
                          <th className="px-4 py-3 font-semibold">Type</th>
                          <th className="px-4 py-3 font-semibold">Submitted</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pros.map((p) => (
                          <tr key={p.userId} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800">
                                {p.name}
                              </p>
                              {p.email ? (
                                <p className="text-xs text-slate-500">
                                  {p.email}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {p.professionalType || '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {fmtDate(p.submittedAt)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                tone={STATUS_VARIANT[p.approvalStatus]}
                                label={p.approvalStatus.replaceAll('_', ' ')}
                              />
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">
                              {p.rejectionReason || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* Commission history */}
              <Section title={`Commission history (${commissions.length})`}>
                {commissions.length === 0 ? (
                  <Empty
                    title="No commissions yet"
                    body="When a professional you onboarded is approved by admin, a commission entry will appear here."
                  />
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[600px] text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Date</th>
                          <th className="px-4 py-3 font-semibold">Professional</th>
                          <th className="px-4 py-3 font-semibold">Amount</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {commissions.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-600">
                              {fmtDate(c.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800">
                                {c.professionalName}
                              </p>
                              {c.professionalEmail ? (
                                <p className="text-xs text-slate-500">
                                  {c.professionalEmail}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {rupees(c.commissionAmount)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                tone={
                                  c.status === 'reversed'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }
                                label={c.status}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* Payout history */}
              <Section title={`Payout history (${payouts.length})`}>
                {payouts.length === 0 ? (
                  <Empty
                    title="No payouts yet"
                    body="Request a payout from your available balance once you've earned ≥ the minimum amount."
                  />
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[600px] text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Requested</th>
                          <th className="px-4 py-3 font-semibold">Amount</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold">Paid on</th>
                          <th className="px-4 py-3 font-semibold">Reference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {payouts.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-600">
                              {fmtDate(p.createdAt)}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {rupees(p.requestedAmount)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                tone={PAYOUT_VARIANT[p.status]}
                                label={p.status}
                              />
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {fmtDate(p.paidAt)}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">
                              {p.paymentReference || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* Footer pills removed — EmployeeHeader carries the
                  Onboarding guide / Terms / Privacy links. */}
            </>
          )}
        </div>
      </main>
      <Footer />

      <PayoutModal
        open={payoutOpen}
        onClose={() => setPayoutOpen(false)}
        summary={summary}
        onSubmitted={() => {
          setPayoutOpen(false);
          load();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// EligibilityRules — banner with the three rules every onboarded
// professional must meet before an admin will mark them APPROVED.
// Lives at the top of the dashboard so every employee sees them on
// every visit.
// ---------------------------------------------------------------------

const ELIGIBILITY_RULES = [
  {
    icon: BriefcaseBusiness,
    title: 'Minimum 5 years work experience',
    body: 'Verified via the professional’s registration documents.',
  },
  {
    icon: Mail,
    title: 'Verified email & phone number',
    body: 'Both OTP-verified during signup before submission to admin.',
  },
  {
    icon: FileBadge2,
    title: 'Registration certificate or card',
    body: 'Bar Council enrolment, CA registration, or equivalent ID upload.',
  },
];

function EligibilityRules() {
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck size={16} className="text-emerald-600" />
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-700">
          Rules to get a professional verified
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ELIGIBILITY_RULES.map((rule) => (
          <div
            key={rule.title}
            className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <rule.icon size={14} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {rule.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-600">{rule.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// PerApprovalBanner — single highlighted source of truth for the per-
// approval (per-listing) rate. The Employee-of-the-Month cards used to
// repeat this number on every card; per the spec it now lives ONLY
// here. The top-performer multiplier is shown alongside as a small
// secondary line.
// ---------------------------------------------------------------------
function PerApprovalBanner({ perListing, multiplier }) {
  const safeMultiplier =
    Number.isFinite(Number(multiplier)) && Number(multiplier) > 0
      ? Number(multiplier)
      : 1;
  const topRate = Number(perListing) * safeMultiplier;
  const showTopRate = safeMultiplier > 1 && Number(perListing) > 0;
  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-amber-100/40 to-amber-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-amber-700">
            <IndianRupee size={12} />
            Per-approval rate
          </p>
          <p className="mt-1 text-3xl font-extrabold text-slate-900">
            {rupees(perListing)}{' '}
            <span className="text-base font-semibold text-slate-500">
              per approved professional
            </span>
          </p>
        </div>
        {showTopRate ? (
          <div className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-right shadow-sm">
            <p className="flex items-center justify-end gap-1 text-[10px] font-semibold uppercase tracking-widest text-amber-700">
              <Trophy size={11} />
              Top performers
            </p>
            <p className="mt-0.5 text-lg font-bold text-amber-700">
              {rupees(topRate)}{' '}
              <span className="text-xs font-semibold text-amber-600">
                / approval ({safeMultiplier}×)
              </span>
            </p>
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-amber-900">
        Commission credits once the admin marks the professional APPROVED.
        Rates are set by admin and may change.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------
// FeaturedEmployees — static "Employees of the Month" recognition
// cards. Numbers are illustrative; the employee_code is masked so
// other staff can't memorise it and impersonate the featured pair.
// Edit the FEATURED_EMPLOYEES array below to rotate this section.
// ---------------------------------------------------------------------

const FEATURED_EMPLOYEES = [
  {
    name: 'Gaurav Sharma',
    title: 'Top Onboarder',
    code: '9876543210',
    region: 'Pune',
    listings: 549,
    // Local asset served from `frontend/public/team/`. Save the
    // attached portrait there as `gaurav-sharma.jpg`. Falls back to
    // an initials avatar if the file is missing.
    photo: '/team/gaurav-sharma.jpg',
    fallbackPhoto:
      'https://ui-avatars.com/api/?name=Gaurav+Sharma&background=d97706&color=fff&size=512&font-size=0.4&bold=true',
  },
  {
    name: 'Rachana Yadav',
    title: 'Top Onboarder',
    code: '9123456789',
    region: 'New Delhi',
    listings: 289,
    photo:
      'https://ui-avatars.com/api/?name=Rachana+Yadav&background=0d9488&color=fff&size=512&font-size=0.4&bold=true',
  },
];

// Mask an employee_code so the panel doesn't leak the full digits.
// Keeps the first 2 and last 2 digits and bullets the middle.
function maskCode(raw) {
  const s = String(raw || '').replace(/\D/g, '');
  if (s.length <= 4) return s;
  const head = s.slice(0, 2);
  const tail = s.slice(-2);
  return `${head}${'•'.repeat(s.length - 4)}${tail}`;
}

function rupeesShort(n) {
  return `₹${(Number(n) || 0).toLocaleString('en-IN')}`;
}

function FeaturedEmployees({ perListing, multiplier }) {
  const safeMultiplier =
    Number.isFinite(Number(multiplier)) && Number(multiplier) > 0
      ? Number(multiplier)
      : 1;
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <Trophy size={16} className="text-amber-600" />
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-700">
          Employees of the month
        </h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          {safeMultiplier > 1 ? `${safeMultiplier}× commission` : 'Featured'}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FEATURED_EMPLOYEES.map((e) => (
          <FeaturedCard
            key={e.code}
            employee={e}
            perListing={Number(perListing) || 0}
            multiplier={safeMultiplier}
          />
        ))}
      </div>
    </section>
  );
}

function FeaturedCard({ employee, perListing, multiplier }) {
  const effectiveRate = perListing * multiplier;
  const earned = (employee.listings || 0) * effectiveRate;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-50 p-5 shadow-sm">
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-200/40 blur-2xl"
        aria-hidden
      />
      <div className="relative flex items-start gap-4">
        {/* Photo with amber ring + trophy badge. Falls back to a
            generated initials avatar if the local file is missing
            (e.g. before the operator drops the JPG in
            `frontend/public/team/`). */}
        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={employee.photo}
            alt={employee.name}
            onError={(e) => {
              if (
                employee.fallbackPhoto &&
                e.currentTarget.src !== employee.fallbackPhoto
              ) {
                e.currentTarget.src = employee.fallbackPhoto;
              }
            }}
            className="h-20 w-20 rounded-2xl object-cover ring-4 ring-amber-300/60"
          />
          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg">
            <Trophy size={13} />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-bold text-slate-900">
              {employee.name}
            </h3>
            <Star
              size={14}
              className="shrink-0 fill-amber-400 text-amber-500"
            />
          </div>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-amber-700">
            {employee.title}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Code{' '}
            <span
              className="font-mono font-semibold text-slate-800"
              title="Employee code is masked for privacy"
            >
              {maskCode(employee.code)}
            </span>{' '}
            · {employee.region}
          </p>

          {/* Stat row — listings + total earned. Per-listing rate moved
              to the dedicated banner above so the dashboard has a single
              authoritative source for the rate. */}
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Mini label="Listings" value={employee.listings} />
            <Mini
              label={multiplier > 1 ? `Earned (${multiplier}×)` : 'Earned'}
              value={rupeesShort(earned)}
              emphasised
            />
          </div>
        </div>
      </div>

      <div className="relative mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-amber-800">
        <TrendingUp size={12} />
        Top onboarder this month — congratulations!
      </div>
    </div>
  );
}

function Mini({ label, value, emphasised }) {
  return (
    <div
      className={`rounded-lg border bg-white p-2 ${
        emphasised
          ? 'border-amber-300 ring-1 ring-amber-200'
          : 'border-slate-200'
      }`}
    >
      <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tint = 'slate', emphasised }) {
  const tints = {
    slate: 'bg-slate-100 text-slate-700',
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    rose: 'bg-rose-100 text-rose-700',
  };
  return (
    <div
      className={`rounded-2xl border bg-white p-4 ${
        emphasised
          ? 'border-amber-300 ring-2 ring-amber-100'
          : 'border-slate-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            tints[tint] || tints.slate
          }`}
        >
          <Icon size={14} />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          {label}
        </p>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ title, body }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{body}</p>
    </div>
  );
}

function Badge({ tone, label }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        tone || 'bg-slate-100 text-slate-700'
      }`}
    >
      {label}
    </span>
  );
}

function PayoutModal({ open, onClose, summary, onSubmitted }) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) {
      setAmount('');
      setError('');
    }
  }, [open]);
  if (!open) return null;
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await request('/api/employee/payouts', {
        method: 'POST',
        body: { requestedAmount: Number(amount) },
        auth: true,
      });
      onSubmitted?.();
    } catch (err) {
      setError(err.message || 'Could not submit payout request.');
    } finally {
      setBusy(false);
    }
  }
  const min = summary?.settings?.minPayout || 0;
  const max = summary?.settings?.maxPayout || 0;
  const avail = summary?.availablePayout || 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h3 className="text-lg font-bold text-slate-900">Request payout</h3>
        <p className="mt-1 text-xs text-slate-600">
          Available balance{' '}
          <span className="font-semibold text-slate-900">{rupees(avail)}</span> ·
          Min {rupees(min)} · Max {rupees(max)} per request.
        </p>
        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">
            Amount (₹)
          </label>
          <input
            inputMode="numeric"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </div>
        {error ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            {error}
          </div>
        ) : null}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : 'Submit request'}
          </button>
        </div>
      </form>
    </div>
  );
}
