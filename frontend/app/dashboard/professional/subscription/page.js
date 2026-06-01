'use client';

// Professional dashboard → Subscription.
// Shows the professional's current plan, usage-vs-limit snapshot, monthly
// vs annual billing toggle, and a grid of plan cards each with an upgrade
// (or "Discuss with Support" for custom) action. For paid plans the
// upgrade flow creates a Razorpay subscription server-side and opens
// Razorpay Checkout so the user can authorise the mandate; subsequent
// activation/charge events flow back through the webhook.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  X,
  Star,
  Loader2,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import EmptyState from '@/components/common/EmptyState';
import {
  listPublicPlans,
  getMySubscription,
  upgradeSubscription,
  openSubscriptionCheckout,
  confirmSubscriptionPayment,
} from '@/services/subscriptionService';
import { useAuth } from '@/hooks/useAuth';
import { refreshCurrentPlanBadge } from '@/components/common/CurrentPlanBadge';
import { ROLES } from '@/utils/constants';

function fmtMoney(amount, currency = 'INR') {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n}`;
  }
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

// One feature row in the plan-card body.
function Feature({ on, children }) {
  return (
    <li className="flex items-start gap-2 text-sm text-slate-700">
      {on ? (
        <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />
      ) : (
        <X size={16} className="mt-0.5 shrink-0 text-slate-300" />
      )}
      <span className={on ? '' : 'text-slate-400 line-through'}>{children}</span>
    </li>
  );
}

function PlanCard({
  plan,
  cycle,
  current,
  busy,
  onUpgrade,
}) {
  const isCurrent = current && current.subscriptionPlanId === plan.id;
  const isCustom = plan.isCustomPlan || plan.planType === 'custom';
  const monthly = fmtMoney(plan.monthlyPrice, plan.currency);
  const annual = fmtMoney(plan.annualPrice, plan.currency);
  const showMonthly = plan.monthlyEnabled;
  const showAnnual = plan.annualEnabled;

  // Pick the headline price + period label for the chosen billing cycle.
  const displayPrice =
    isCustom
      ? 'Custom'
      : cycle === 'annual' && showAnnual
        ? annual || 'Custom'
        : showMonthly
          ? monthly || 'Free'
          : annual || '—';
  const displayPeriod =
    isCustom
      ? ''
      : cycle === 'annual' && showAnnual
        ? '/year'
        : showMonthly
          ? '/month'
          : '/year';

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-white p-5 shadow-card transition ${
        plan.recommendedBadge
          ? 'border-amber-300 ring-2 ring-amber-200'
          : 'border-slate-200'
      } ${isCurrent ? 'ring-2 ring-emerald-300' : ''}`}
    >
      {/* Top-right badges */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
        {plan.recommendedBadge && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            <Star size={10} />
            Recommended
          </span>
        )}
        {plan.featuredBadge && (
          <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800">
            Featured
          </span>
        )}
        {isCurrent && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
            <CheckCircle2 size={10} />
            Current plan
          </span>
        )}
      </div>

      <div>
        <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
        {plan.shortDescription && (
          <p className="mt-1 text-xs text-slate-600">{plan.shortDescription}</p>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-slate-900">{displayPrice}</span>
        {displayPeriod && (
          <span className="text-sm text-slate-500">{displayPeriod}</span>
        )}
      </div>
      {cycle === 'annual' && showAnnual && plan.annualDiscountPercent ? (
        <p className="mt-1 text-xs font-semibold text-emerald-700">
          Save {Number(plan.annualDiscountPercent)}% vs monthly
        </p>
      ) : null}

      {/* Feature highlights */}
      <ul className="mt-5 space-y-1.5">
        <Feature on>
          {plan.unlimitedCases
            ? 'Unlimited cases'
            : `Up to ${plan.caseLimit ?? 0} cases`}
        </Feature>
        <Feature on>
          {Number(plan.commissionPercent || 0)}% platform commission
        </Feature>
        <Feature on={plan.firmCreationAllowed}>
          {plan.firmCreationAllowed
            ? plan.unlimitedFirms
              ? 'Unlimited firms'
              : `${plan.firmLimit ?? 0} firm${plan.firmLimit === 1 ? '' : 's'}`
            : 'Firm creation'}
        </Feature>
        <Feature on={plan.firmCreationAllowed}>
          {plan.firmCreationAllowed
            ? plan.unlimitedProfessionals
              ? 'Unlimited team members'
              : `${plan.professionalsAllowed ?? 0} team member${
                  plan.professionalsAllowed === 1 ? '' : 's'
                }`
            : 'Team members'}
        </Feature>
        <Feature on={plan.featuredProfileAllowed}>Featured profile</Feature>
        <Feature on={plan.priorityListing}>Priority listing in search</Feature>
        <Feature on={plan.whatsappSupport}>WhatsApp support</Feature>
        <Feature on={plan.analyticsDashboardAllowed}>
          Analytics dashboard
        </Feature>
        <Feature on>
          {plan.supportType
            ? plan.supportType.charAt(0).toUpperCase() +
              plan.supportType.slice(1) +
              ' support'
            : 'Basic support'}
        </Feature>
      </ul>

      <div className="mt-5 border-t border-slate-100 pt-4">
        {isCurrent ? (
          <Button variant="outline" disabled className="w-full">
            <CheckCircle2 size={14} />
            Your current plan
          </Button>
        ) : isCustom ? (
          <Button
            href={plan.customCtaTarget || '/contact?topic=custom-plan'}
            variant="primary"
            className="w-full bg-slate-900 hover:bg-slate-800"
          >
            {plan.customCtaLabel || 'Discuss with Support'}
            <ArrowRight size={14} />
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => onUpgrade(plan)}
            className="w-full bg-amber-600 hover:bg-amber-700"
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Switching…
              </>
            ) : (
              <>
                Switch to {plan.name}
                <ArrowRight size={14} />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ProSubscriptionPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cycle, setCycle] = useState('monthly');
  const [busyPlanId, setBusyPlanId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [p, sub] = await Promise.all([
        listPublicPlans(),
        getMySubscription(),
      ]);
      setPlans(p);
      setCurrent(sub);
    } catch (err) {
      setError(err.message || 'Failed to load subscription details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpgrade(plan) {
    if (busyPlanId) return;
    setBusyPlanId(plan.id);
    setError('');
    setSuccess('');
    try {
      const sub = await upgradeSubscription(plan.slug, cycle);
      // For paid plans the server returns a Razorpay subscription_id — open
      // Razorpay Checkout so the user can authorise the mandate. On success
      // we POST the signed callback back to /api/subscriptions/confirm so
      // the row flips to active immediately — without depending on the
      // webhook (which is unreachable on localhost).
      if (sub && sub.razorpay && sub.razorpay.subscriptionId) {
        try {
          const result = await openSubscriptionCheckout({
            subscriptionId: sub.razorpay.subscriptionId,
            planName: plan.name,
            prefill: {
              name:
                (user &&
                  (user.fullName ||
                    [user.firstName, user.lastName]
                      .filter(Boolean)
                      .join(' '))) ||
                '',
              email: (user && user.email) || '',
              phone: (user && user.mobileNumber) || '',
            },
          });
          if (result && result.cancelled) {
            setError(
              `Payment cancelled. Your ${plan.name} subscription is still pending — re-open this page and click Switch to retry.`
            );
          } else if (result && result.paymentId && result.signature) {
            try {
              const confirmed = await confirmSubscriptionPayment({
                razorpayPaymentId: result.paymentId,
                razorpaySubscriptionId: result.subscriptionId,
                razorpaySignature: result.signature,
              });
              if (confirmed && confirmed.subscription) {
                setSuccess(
                  `${plan.name} is now active. Your subscription has been recorded.`
                );
              } else {
                setSuccess(
                  `${plan.name} authorised. Activation will appear shortly.`
                );
              }
            } catch (confirmErr) {
              setError(
                confirmErr.message ||
                  'Payment authorised but server-side confirmation failed. Refresh in a moment.'
              );
            }
          } else {
            setSuccess(
              `${plan.name} authorised. Activation will appear shortly.`
            );
          }
        } catch (chkErr) {
          setError(
            chkErr.message ||
              `Could not open Razorpay Checkout for ${plan.name}.`
          );
        }
      } else {
        setSuccess(`Switched to ${plan.name}. You're all set.`);
      }
      setCurrent(sub);
      // Invalidate the header badge so the new plan name appears on the
      // next render without requiring a full reload.
      refreshCurrentPlanBadge();
      // Refresh to pull the latest subscription + plan join (the webhook
      // may already have flipped status to 'active').
      await load();
    } catch (err) {
      setError(err.message || `Could not switch to ${plan.name}.`);
    } finally {
      setBusyPlanId('');
    }
  }

  // Current-plan usage block. Until we wire usage counters we surface
  // limits + commission so the pro can see at a glance what they get.
  const usage = useMemo(() => {
    const plan = current && current.plan;
    if (!plan) return null;
    return {
      commission: `${Number(plan.commissionPercent || 0)}%`,
      cases: plan.unlimitedCases
        ? 'Unlimited'
        : `${plan.caseLimit ?? 0}`,
      firms: plan.firmCreationAllowed
        ? plan.unlimitedFirms
          ? 'Unlimited'
          : `${plan.firmLimit ?? 0}`
        : 'Not allowed',
      team: plan.firmCreationAllowed
        ? plan.unlimitedProfessionals
          ? 'Unlimited'
          : `${plan.professionalsAllowed ?? 0}`
        : 'Not allowed',
      support:
        plan.supportType?.charAt(0).toUpperCase() + plan.supportType?.slice(1),
    };
  }, [current]);

  return (
    <DashboardLayout
      role={ROLES.PROFESSIONAL}
      title="Subscription"
      subtitle="Manage your plan, see what's included, and upgrade when you need more."
    >
      <div className="space-y-5">
        {/* Current plan card */}
        {loading ? (
          <div className="h-32 w-full animate-pulse rounded-2xl bg-slate-100" />
        ) : (
          <Card className="!p-0">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Your current plan
                </p>
                <div className="mt-1 flex flex-wrap items-baseline gap-2">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {(current && current.plan && current.plan.name) ||
                      'No active plan'}
                  </h2>
                  {current && current.paymentStatus && (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        current.paymentStatus === 'paid'
                          ? 'bg-emerald-100 text-emerald-700'
                          : current.paymentStatus === 'free'
                            ? 'bg-teal-100 text-teal-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {current.paymentStatus}
                    </span>
                  )}
                </div>
                {current && current.endDate && (
                  <p className="mt-1 text-xs text-slate-500">
                    Renews / expires {fmtDate(current.endDate)}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={load}
                disabled={loading}
              >
                <RefreshCw size={14} />
                Refresh
              </Button>
            </div>
            {usage && (
              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 p-5 sm:grid-cols-5">
                <Snapshot label="Commission" value={usage.commission} />
                <Snapshot label="Cases" value={usage.cases} />
                <Snapshot label="Firms" value={usage.firms} />
                <Snapshot label="Team members" value={usage.team} />
                <Snapshot label="Support" value={usage.support} />
              </div>
            )}
          </Card>
        )}

        {/* Status banners */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Billing-cycle toggle */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">
            Available plans
          </h2>
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setCycle('monthly')}
              className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                cycle === 'monthly'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setCycle('annual')}
              className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                cycle === 'annual'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Annual
            </button>
          </div>
        </div>

        {/* Plan grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-96 w-full animate-pulse rounded-2xl bg-slate-100"
              />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <EmptyState
            icon={<CreditCard size={22} />}
            title="No plans available"
            description="Ask an admin to publish subscription plans before you can subscribe."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                cycle={cycle}
                current={current}
                busy={busyPlanId === plan.id}
                onUpgrade={handleUpgrade}
              />
            ))}
          </div>
        )}

        <p className="text-xs text-slate-500">
          Paid plans use Razorpay recurring billing. After you click Switch we
          open a secure Razorpay window to authorise the mandate; your
          subscription activates as soon as the first charge clears (usually
          within a few seconds).
        </p>

        <p className="text-center text-xs text-slate-500">
          Need help choosing?{' '}
          <Link
            href="/contact?topic=subscription"
            className="font-semibold text-amber-700 hover:text-amber-800"
          >
            Talk to support
          </Link>
        </p>
      </div>
    </DashboardLayout>
  );
}

function Snapshot({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
