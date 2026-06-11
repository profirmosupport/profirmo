'use client';

// Admin → User detail page.
// One-stop view for every monetary record tied to a single user:
//   • Current subscription + history (with admin "Activate" override),
//   • Booking payments (both as payer and as payee),
//   • Payout requests they have raised.
// The admin users list links into this page via "View details".

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Mail,
  Phone,
  Shield,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  CreditCard,
  Wallet,
  ReceiptText,
  Banknote,
  ShieldAlert,
  CalendarClock,
  Percent,
  Repeat,
  Sparkles,
  X,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Modal from '@/components/common/Modal';
import Badge from '@/components/common/Badge';
import EmptyState from '@/components/common/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { ROLES } from '@/utils/constants';
import {
  getUser,
  getUserTransactions,
  adminActivateUserSubscription,
} from '@/services/adminService';
import { adminListPlans } from '@/services/subscriptionService';
import { formatINR } from '@/services/paymentService';
import { resolveFileUrl } from '@/services/fileService';
import { formatDate } from '@/utils/formatters';

const STATUS_VARIANT = {
  active: 'green',
  paid: 'green',
  approved: 'green',
  free: 'blue',
  pending: 'amber',
  pending_verification: 'amber',
  created: 'amber',
  authenticated: 'amber',
  suspended: 'red',
  failed: 'red',
  refunded: 'gray',
  cancelled: 'gray',
  rejected: 'red',
};

function StatusBadge({ value }) {
  const v = String(value || '').toLowerCase();
  return (
    <Badge variant={STATUS_VARIANT[v] || 'gray'}>{value || '—'}</Badge>
  );
}

// One label-value pair in the profile card.
function Field({ label, value, icon: Icon }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        {Icon && <Icon size={11} />}
        {label}
      </p>
      <p className="mt-0.5 text-sm text-slate-900">{value || '—'}</p>
    </div>
  );
}

// One stat tile across the top.
function Stat({ label, value, icon: Icon, hint }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
        </div>
        {Icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Icon size={18} />
          </span>
        )}
      </div>
    </Card>
  );
}

function ProfileCard({ user }) {
  const fullName =
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.name ||
    '—';
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {user.profilePhoto ? (
            <img
              // `user.profilePhoto` may be a bare S3 key (e.g.
              // `profile-images/abc.jpg`) or a legacy `/uploads/...`
              // path. `resolveFileUrl` turns either into an absolute
              // URL using the live storage config (S3 CDN base or
              // API base for local dev).
              src={resolveFileUrl(user.profilePhoto)}
              alt={fullName}
              className="h-14 w-14 rounded-full object-cover ring-2 ring-amber-200"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-lg font-bold text-amber-700">
              {(fullName || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold text-slate-900">{fullName}</h2>
            <p className="text-xs text-slate-500">User id: <span className="font-mono">{user.id}</span></p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={user.status} />
          <Badge variant="blue">{user.role}</Badge>
          {user.emailVerified && <Badge variant="green">email verified</Badge>}
          {user.mobileVerified && (
            <Badge variant="green">phone verified</Badge>
          )}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Email" value={user.email} icon={Mail} />
        <Field label="Phone" value={user.mobileNumber} icon={Phone} />
        <Field label="Role" value={user.role} icon={Shield} />
        <Field label="Member since" value={formatDate(user.memberSince || user.createdAt)} icon={CheckCircle2} />
      </div>
    </Card>
  );
}

function fmtRupees(n, currency = 'INR') {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `${currency} ${v}`;
  }
}

// Headline card showing the user's active (or pending) subscription:
// plan name, billing cycle, price, commission, dates and Razorpay link.
function CurrentSubscriptionCard({ subscription }) {
  if (!subscription) {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <CreditCard size={18} />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Current subscription
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-700">
              No active or pending subscription on file.
            </p>
          </div>
        </div>
      </Card>
    );
  }
  const { plan } = subscription;
  const cycle = subscription.billingCycle || 'monthly';
  const headlinePrice =
    cycle === 'annual'
      ? fmtRupees(plan && plan.annualPrice, plan && plan.currency)
      : fmtRupees(plan && plan.monthlyPrice, plan && plan.currency);
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <CreditCard size={20} />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Current subscription
            </p>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
              <h3 className="text-lg font-bold text-slate-900">
                {(plan && plan.name) || subscription.subscriptionPlanId}
              </h3>
              {plan && plan.slug && (
                <span className="font-mono text-xs text-slate-500">
                  {plan.slug}
                </span>
              )}
            </div>
            {headlinePrice && (
              <p className="mt-1 text-sm text-slate-600">
                {headlinePrice}
                <span className="text-slate-400">
                  {' '}
                  · {cycle === 'annual' ? 'per year' : 'per month'}
                </span>
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={subscription.status} />
          <Badge variant={subscription.paymentStatus === 'paid' ? 'green' : 'amber'}>
            payment: {subscription.paymentStatus}
          </Badge>
          {subscription.razorpaySubscriptionStatus && (
            <Badge variant="blue">
              razorpay: {subscription.razorpaySubscriptionStatus}
            </Badge>
          )}
          {subscription.autoRenew && <Badge variant="green">auto-renew</Badge>}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field
          label="Billing cycle"
          value={cycle.charAt(0).toUpperCase() + cycle.slice(1)}
          icon={Repeat}
        />
        <Field
          label="Commission"
          value={`${Number(subscription.commissionPercentSnapshot || 0)}%`}
          icon={Percent}
        />
        <Field
          label="Started"
          value={formatDate(subscription.startDate)}
          icon={CalendarClock}
        />
        <Field
          label="Renews / expires"
          value={formatDate(subscription.endDate)}
          icon={CalendarClock}
        />
        <Field
          label="Amount paid"
          value={
            subscription.amountPaid
              ? fmtRupees(subscription.amountPaid, subscription.currency)
              : '—'
          }
        />
        <Field
          label="Transaction id"
          value={subscription.transactionId || '—'}
        />
        <Field
          label="Razorpay subscription"
          value={subscription.razorpaySubscriptionId || '—'}
        />
        <Field
          label="Razorpay customer"
          value={subscription.razorpayCustomerId || '—'}
        />
      </div>
      {(subscription.razorpaySubscriptionId || subscription.razorpayShortUrl) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs font-semibold">
          {subscription.razorpaySubscriptionId && (
            <a
              href={`https://dashboard.razorpay.com/app/subscriptions/${subscription.razorpaySubscriptionId}`}
              target="_blank"
              rel="noreferrer"
              className="text-amber-700 hover:text-amber-800"
            >
              Open in Razorpay dashboard →
            </a>
          )}
          {subscription.razorpayShortUrl && (
            <a
              href={subscription.razorpayShortUrl}
              target="_blank"
              rel="noreferrer"
              className="text-slate-600 hover:text-slate-800"
            >
              Customer payment page →
            </a>
          )}
        </div>
      )}
      {subscription.adminNotes && (
        <p className="mt-3 text-xs text-slate-500">{subscription.adminNotes}</p>
      )}
    </Card>
  );
}

// Full subscription history (plan changes, cancellations, etc.) shown
// when the user has had more than one row on file.
function SubscriptionHistoryTable({ rows }) {
  if (!rows || rows.length === 0) return null;
  return (
    <Card padding={false}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Started</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Cycle</th>
              <th className="px-4 py-3 font-semibold">Commission</th>
              <th className="px-4 py-3 font-semibold">Ends</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Razorpay sub</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">
                  {formatDate(s.startDate)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {(s.plan && s.plan.name) || s.subscriptionPlanId}
                </td>
                <td className="px-4 py-3 capitalize text-slate-600">
                  {s.billingCycle}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {Number(s.commissionPercentSnapshot || 0)}%
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {s.endDate ? formatDate(s.endDate) : '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge value={s.status} />
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                  {s.razorpaySubscriptionId || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function BookingPaymentsTable({ rows }) {
  if (!rows || rows.length === 0) {
    return (
      <EmptyState
        icon={<ReceiptText size={22} />}
        title="No booking payments"
        description="This user has not paid for or received payment for any bookings."
      />
    );
  }
  return (
    <Card padding={false}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">When</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Counterparty</th>
              <th className="px-4 py-3 font-semibold">Booking</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Markup</th>
              <th className="px-4 py-3 font-semibold">Net</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Payment ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">
                  {formatDate(p.capturedAt || p.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={p.role === 'payee' ? 'green' : 'amber'}>
                    {p.role === 'payee' ? 'Received' : 'Paid'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {p.counterpartyName || '—'}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {p.booking
                    ? `${p.booking.date || ''}${
                        p.booking.time ? ` ${p.booking.time}` : ''
                      } · ${p.booking.duration || 0} min`
                    : '—'}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-800">
                  {formatINR(p.amount)}
                </td>
                <td className="px-4 py-3 text-rose-600">
                  {p.platformFee > 0 ? `−${formatINR(p.platformFee)}` : '—'}
                </td>
                <td className="px-4 py-3 text-emerald-700">
                  {p.netAmount ? formatINR(p.netAmount) : '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge value={p.status} />
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                  {p.razorpayPaymentId || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PayoutRequestsTable({ rows }) {
  if (!rows || rows.length === 0) {
    return (
      <EmptyState
        icon={<Banknote size={22} />}
        title="No payout requests"
        description="This professional has not raised a payout request yet."
      />
    );
  }
  return (
    <Card padding={false}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">When</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Method</th>
              <th className="px-4 py-3 font-semibold">Reference</th>
              <th className="px-4 py-3 font-semibold">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">
                  {formatDate(p.createdAt)}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-800">
                  {formatINR(p.amount)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge value={p.status} />
                </td>
                <td className="px-4 py-3 capitalize text-slate-600">
                  {p.method || p.payoutMethod || '—'}
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                  {p.transferRef || p.referenceId || '—'}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {p.reason || p.rejectionReason || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// Modal — admin manual subscription activation. Plan select is sourced
// from the admin plan list (active plans only); end date defaults to
// "1 month from today" but the admin can pick any future date.
function ActivateSubscriptionModal({ open, onClose, userName, onSubmit }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [planId, setPlanId] = useState('');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [endDate, setEndDate] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Default the end date to one month from today.
  function defaultEndDate(cycle) {
    const d = new Date();
    if (cycle === 'annual') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setError('');
    setLoading(true);
    setPlanId('');
    setBillingCycle('monthly');
    setEndDate(defaultEndDate('monthly'));
    setAmountPaid('');
    setAdminNotes('');
    (async () => {
      try {
        const rows = await adminListPlans({ status: 'active' });
        if (!active) return;
        setPlans(rows || []);
      } catch (err) {
        if (active) setError(err.message || 'Failed to load plans.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open]);

  // When the cycle flips, reset the end date suggestion (admin can still
  // edit).
  useEffect(() => {
    if (!open) return;
    setEndDate(defaultEndDate(billingCycle));
  }, [billingCycle, open]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === planId) || null,
    [plans, planId]
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!planId) {
      setError('Pick a plan to activate.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({
        planId,
        billingCycle,
        endDate: endDate || null,
        amountPaid: amountPaid === '' ? null : Number(amountPaid),
        adminNotes: adminNotes || '',
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to activate subscription.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Activate subscription"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || loading || !planId}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {submitting ? 'Activating…' : 'Activate'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-600">
          Grant {userName ? <strong>{userName}</strong> : 'this user'} access
          to a plan without going through Razorpay. Any existing active
          subscription (including the Razorpay mandate) will be cancelled
          first.
        </p>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Select
          label="Plan"
          name="planId"
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          disabled={loading || submitting}
          options={[
            { value: '', label: loading ? 'Loading plans…' : 'Select a plan…' },
            ...plans.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.planType})`,
            })),
          ]}
        />

        <Select
          label="Billing cycle"
          name="billingCycle"
          value={billingCycle}
          onChange={(e) => setBillingCycle(e.target.value)}
          disabled={submitting}
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'annual', label: 'Annual' },
            { value: 'lifetime', label: 'Lifetime (no expiry)' },
            { value: 'custom', label: 'Custom window' },
          ]}
        />

        <Input
          label="Access ends on"
          name="endDate"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          disabled={submitting || billingCycle === 'lifetime'}
          hint={
            billingCycle === 'lifetime'
              ? 'Lifetime grants have no expiry.'
              : 'Leave blank for the default 1-cycle window.'
          }
        />

        <Input
          label="Amount paid (optional)"
          name="amountPaid"
          type="number"
          step="0.01"
          value={amountPaid}
          onChange={(e) => setAmountPaid(e.target.value)}
          disabled={submitting}
          placeholder={
            selectedPlan
              ? `Defaults to ₹${
                  billingCycle === 'annual'
                    ? selectedPlan.annualPrice || 0
                    : selectedPlan.monthlyPrice || 0
                }`
              : 'Plan price will be used'
          }
          hint="Set to 0 for a comp / free grant."
        />

        <Input
          label="Admin notes (optional)"
          name="adminNotes"
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          disabled={submitting}
          placeholder="e.g. Manual grant per support ticket #1234"
        />
      </form>
    </Modal>
  );
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = params && params.id;
  const { user: me, loading: authLoading, isAuthenticated } = useAuth();
  const isAdmin = me && me.role === ROLES.PLATFORM_ADMIN;

  const [user, setUser] = useState(null);
  const [tx, setTx] = useState(null);
  const [activateOpen, setActivateOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      // Tx endpoint returns the user too, so we use it as the single
      // source of truth and only fall back to getUser if it 404s
      // (e.g. transactions endpoint failed but the user exists).
      const result = await getUserTransactions(userId);
      setTx(result);
      setUser(result && result.user);
    } catch (err) {
      try {
        const u = await getUser(userId);
        setUser(u);
        setTx(null);
      } catch {
        /* fall through to error display */
      }
      setError(err.message || 'Failed to load user transactions.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => tx && tx.totals, [tx]);

  // ----- Guards ------------------------------------------------------------

  if (authLoading || !isAuthenticated) {
    return <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="User detail" />;
  }
  if (!isAdmin) {
    return (
      <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="User detail">
        <EmptyState
          icon={<ShieldAlert size={24} />}
          title="Access denied"
          description="You need a platform administrator account to view this page."
          action={
            <Button href="/dashboard" variant="outline">
              Back to dashboard
            </Button>
          }
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="User detail"
      subtitle="Profile + every monetary transaction tied to this account"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button href="/admin/users" variant="outline" size="sm">
            <ArrowLeft size={14} />
            Back to users
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setActivateOpen(true)}
              disabled={!user}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Sparkles size={14} />
              Activate subscription
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw size={14} />
              Refresh
            </Button>
          </div>
        </div>

        {actionMessage && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <>
            <div className="h-32 w-full animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-40 w-full animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-40 w-full animate-pulse rounded-2xl bg-slate-100" />
          </>
        ) : !user ? (
          <EmptyState
            icon={<ShieldAlert size={24} />}
            title="User not found"
            description="No user matches this id, or you don't have access."
          />
        ) : (
          <>
            <ProfileCard user={user} />

            {/* Current subscription */}
            <CurrentSubscriptionCard subscription={tx && tx.currentSubscription} />

            {/* Subscription history — only when the user has more than the
                row already surfaced in CurrentSubscriptionCard. */}
            {tx &&
              tx.subscriptionHistory &&
              tx.subscriptionHistory.length > 1 && (
                <section className="space-y-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Subscription history
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {tx.subscriptionHistory.length} row
                      {tx.subscriptionHistory.length === 1 ? '' : 's'}
                    </span>
                  </h3>
                  <SubscriptionHistoryTable rows={tx.subscriptionHistory} />
                </section>
              )}

            {/* Summary tiles */}
            {totals && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Stat
                  label="Bookings received"
                  value={formatINR(totals.bookingPaidIn || 0)}
                  icon={Wallet}
                  hint="Gross from clients (paid)"
                />
                <Stat
                  label="Bookings paid"
                  value={formatINR(totals.bookingSpent || 0)}
                  icon={ReceiptText}
                  hint="Spent on bookings"
                />
                <Stat
                  label="Payouts paid"
                  value={formatINR(totals.payoutPaid || 0)}
                  icon={Banknote}
                  hint="Released to bank"
                />
              </div>
            )}

            {/* Booking payments */}
            <section className="space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                Booking payments
                {tx && tx.bookingPayments && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {tx.bookingPayments.length} row
                    {tx.bookingPayments.length === 1 ? '' : 's'}
                  </span>
                )}
              </h3>
              <BookingPaymentsTable rows={tx && tx.bookingPayments} />
            </section>

            {/* Payout requests */}
            {tx && tx.payoutRequests && tx.payoutRequests.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900">
                  Payout requests
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {tx.payoutRequests.length} row
                    {tx.payoutRequests.length === 1 ? '' : 's'}
                  </span>
                </h3>
                <PayoutRequestsTable rows={tx.payoutRequests} />
              </section>
            )}
          </>
        )}
      </div>

      <ActivateSubscriptionModal
        open={activateOpen}
        onClose={() => setActivateOpen(false)}
        userName={
          user &&
          (user.fullName ||
            [user.firstName, user.lastName].filter(Boolean).join(' ') ||
            user.email)
        }
        onSubmit={async (body) => {
          const sub = await adminActivateUserSubscription(userId, body);
          setActionMessage(
            sub && sub.plan
              ? `Activated ${sub.plan.name} (${sub.billingCycle}) for this user.`
              : 'Subscription activated.'
          );
          // Auto-clear the success banner after a few seconds.
          setTimeout(() => setActionMessage(''), 6000);
          await load();
        }}
      />
    </DashboardLayout>
  );
}
