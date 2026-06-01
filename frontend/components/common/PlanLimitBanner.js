'use client';

// PlanLimitBanner — renders the "you've hit your plan limit" callout with
// a CTA that routes to the subscription page. No-ops for errors that
// aren't plan-limit failures, so callers can render it unconditionally:
//
//     <PlanLimitBanner err={lastError} />
//
// Reads `err.payload` (the JSON body from the backend) for code +
// metadata. The shape mirrors the deny() helper in
// backend/src/services/subscriptionGateService.js.

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';

function getPayload(err) {
  if (!err) return null;
  const p = err.payload || err;
  if (!p || p.code !== 'PLAN_LIMIT_REACHED') return null;
  return p;
}

export default function PlanLimitBanner({ err, className = '' }) {
  const payload = getPayload(err);
  if (!payload) return null;

  const planName = payload.planName || 'your current plan';
  const limit = payload.limit;
  const currentCount = payload.currentCount;
  const message =
    payload.message || `You've reached a limit on ${planName}.`;

  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50 p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <AlertTriangle size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
            <Sparkles size={14} className="shrink-0" />
            Plan limit reached
          </p>
          <p className="mt-1 text-sm text-amber-800">{message}</p>
          {limit !== null && limit !== undefined && (
            <p className="mt-1 text-xs text-amber-700/80">
              Plan: <span className="font-mono font-semibold">{planName}</span>
              {currentCount !== null && currentCount !== undefined ? (
                <>
                  {' '}· Used{' '}
                  <span className="font-mono font-semibold">
                    {currentCount} / {limit}
                  </span>
                </>
              ) : null}
            </p>
          )}
          <Link
            href="/dashboard/professional/subscription"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700"
          >
            Upgrade your plan
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper for non-React callers (toasts, validators) — returns the
 * banner payload if the error is plan-limit, null otherwise.
 */
export function getPlanLimitPayload(err) {
  return getPayload(err);
}
