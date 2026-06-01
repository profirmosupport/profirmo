'use client';

// CurrentPlanCard — top-of-dashboard summary of the professional's active
// subscription plan, with a prominent CTA to the subscription page. Used
// on /dashboard/professional and (later) /dashboard/firm.
//
// Renders nothing for users without a subscription on record so the
// dashboard doesn't show a confusing "Free plan" panel for clients or
// firm-admins who haven't been backfilled yet.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ArrowRight,
  CreditCard,
  Briefcase,
  Building2,
  Headphones,
  Star,
  Loader2,
} from 'lucide-react';
import { getMySubscription } from '@/services/subscriptionService';

const TYPE_BADGE = {
  free: 'bg-teal-100 text-teal-700',
  paid: 'bg-amber-100 text-amber-800',
  custom: 'bg-violet-100 text-violet-700',
};

const PAYMENT_BADGE = {
  paid: 'bg-emerald-100 text-emerald-700',
  free: 'bg-teal-100 text-teal-700',
  pending: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-700',
};

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

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/70 text-amber-700">
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-900/70">
          {label}
        </p>
        <p className="truncate text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export default function CurrentPlanCard({
  manageHref = '/dashboard/professional/subscription',
}) {
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await getMySubscription();
        if (!active) return;
        setSub(s);
      } catch (err) {
        if (active) setError(err.message || 'Could not load your plan.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
        <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
        <p className="text-sm text-amber-800">Loading your plan…</p>
      </div>
    );
  }
  if (error || !sub || !sub.plan) {
    // Quietly bail when the user has no sub yet — better than a noisy
    // "no plan" banner on a dashboard the user just landed on.
    return null;
  }

  const plan = sub.plan;
  const isCustom = plan.isCustomPlan || plan.planType === 'custom';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-amber-50/40 to-white shadow-card">
      {/* Decorative star burst — purely cosmetic. */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-200/40 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative grid gap-4 p-5 sm:p-6 lg:grid-cols-[1.4fr_1fr] lg:gap-6">
        {/* Left: plan headline + meta + CTAs */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-800">
              <Sparkles size={10} />
              Your plan
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                TYPE_BADGE[plan.planType] || 'bg-slate-100 text-slate-700'
              }`}
            >
              {plan.planType}
            </span>
            {/* Show payment status only when it adds info beyond the plan
                type — i.e. NOT for free plans where it'd just duplicate the
                "Free" pill. Paid plans surface 'paid' / 'pending' / 'failed'. */}
            {sub.paymentStatus && sub.paymentStatus !== 'free' && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                  PAYMENT_BADGE[sub.paymentStatus] ||
                  'bg-slate-100 text-slate-700'
                }`}
              >
                {sub.paymentStatus}
              </span>
            )}
            {plan.recommendedBadge && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-violet-700">
                <Star size={10} />
                Recommended
              </span>
            )}
          </div>

          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            {plan.name}
          </h2>
          {plan.shortDescription && (
            <p className="mt-1 max-w-prose text-sm text-slate-600">
              {plan.shortDescription}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
            {sub.billingCycle && (
              <span className="rounded-md bg-white/70 px-2 py-1">
                Billed{' '}
                <span className="font-semibold text-slate-900">
                  {sub.billingCycle}
                </span>
              </span>
            )}
            {sub.endDate ? (
              <span className="rounded-md bg-white/70 px-2 py-1">
                Renews{' '}
                <span className="font-semibold text-slate-900">
                  {fmtDate(sub.endDate)}
                </span>
              </span>
            ) : (
              <span className="rounded-md bg-white/70 px-2 py-1">No expiry</span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={manageHref}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-glow-sm transition hover:bg-amber-700 hover:shadow-glow"
            >
              {isCustom ? 'Manage subscription' : 'Upgrade plan'}
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Right: at-a-glance plan stats */}
        <div className="grid grid-cols-2 gap-3 self-center sm:gap-4">
          <Stat
            icon={CreditCard}
            label="Commission"
            value={`${Number(plan.commissionPercent || 0)}%`}
          />
          <Stat
            icon={Briefcase}
            label="Cases"
            value={
              plan.unlimitedCases
                ? 'Unlimited'
                : plan.caseLimit !== null && plan.caseLimit !== undefined
                  ? plan.caseLimit
                  : '—'
            }
          />
          <Stat
            icon={Building2}
            label="Firm"
            value={
              plan.firmCreationAllowed
                ? plan.unlimitedFirms
                  ? 'Unlimited'
                  : plan.firmLimit ?? 1
                : 'Not allowed'
            }
          />
          <Stat
            icon={Headphones}
            label="Support"
            value={
              plan.supportType
                ? plan.supportType.charAt(0).toUpperCase() +
                  plan.supportType.slice(1)
                : 'Basic'
            }
          />
        </div>
      </div>
    </div>
  );
}
