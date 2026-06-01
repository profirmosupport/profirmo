'use client';

// QuotaBanner — compact usage strip ("Used 3 / 5 · 2 remaining") with a
// progress bar and an Upgrade link. Used at the top of any list page
// gated by a plan limit (cases, firm cases, members, …).
//
// Props:
//   label         — friendly noun, e.g. "Cases", "Firm cases"
//   used          — current count (number)
//   limit         — null/undefined for unlimited
//   unlimited     — boolean
//   remaining     — explicit remaining count (null when unlimited)
//   upgradeHref   — destination for the Upgrade CTA
//                   (default: /dashboard/professional/subscription)
//   helpText      — optional extra line under the bar

import Link from 'next/link';
import { Sparkles, ArrowRight, Infinity as InfinityIcon } from 'lucide-react';

export default function QuotaBanner({
  label,
  used,
  limit,
  unlimited,
  remaining,
  planName,
  upgradeHref = '/dashboard/professional/subscription',
  helpText,
  // Optional ReactNode slot for inline actions (e.g. "New case" +
  // "Refresh"). Renders on the right of the header row so the card
  // doubles as the page toolbar.
  actions,
}) {
  // Unlimited — friendly chip, no progress bar, no upgrade CTA.
  if (unlimited || limit === null || limit === undefined) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-emerald-800">
          <InfinityIcon size={16} />
          <span>
            <span className="font-semibold">{label}</span> — unlimited on your
            current plan{planName ? ` (${planName})` : ''}.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {used !== undefined && used !== null && (
            <span className="rounded-md bg-white/70 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              {used} total
            </span>
          )}
          {actions}
        </div>
      </div>
    );
  }

  const safeUsed = Number(used) || 0;
  const safeLimit = Number(limit) || 0;
  const ratio = safeLimit === 0 ? 1 : Math.min(1, safeUsed / safeLimit);
  const reachedLimit = safeUsed >= safeLimit;
  const nearLimit = !reachedLimit && ratio >= 0.8;

  const accent = reachedLimit
    ? {
        wrap: 'border-red-200 bg-red-50',
        bar: 'bg-red-500',
        text: 'text-red-800',
        subtext: 'text-red-700',
      }
    : nearLimit
      ? {
          wrap: 'border-amber-200 bg-amber-50',
          bar: 'bg-amber-500',
          text: 'text-amber-900',
          subtext: 'text-amber-800',
        }
      : {
          wrap: 'border-slate-200 bg-white',
          bar: 'bg-amber-500',
          text: 'text-slate-900',
          subtext: 'text-slate-500',
        };

  return (
    <div className={`rounded-xl border ${accent.wrap} px-4 py-3`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={`text-sm font-medium ${accent.text}`}>
          <span className="font-semibold">{label}</span>{' '}
          <span className="font-mono">
            {safeUsed} / {safeLimit}
          </span>
          {' · '}
          <span className="font-semibold">
            {Math.max(0, safeLimit - safeUsed)} remaining
          </span>
          {planName && (
            <span className={`ml-2 text-xs ${accent.subtext}`}>
              on {planName}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(reachedLimit || nearLimit) && (
            <Link
              href={upgradeHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
            >
              <Sparkles size={12} />
              Upgrade plan
              <ArrowRight size={12} />
            </Link>
          )}
          {actions}
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
        <div
          className={`h-full rounded-full ${accent.bar} transition-all`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      {helpText && (
        <p className={`mt-2 text-xs ${accent.subtext}`}>{helpText}</p>
      )}
      {reachedLimit && !helpText && (
        <p className={`mt-2 text-xs ${accent.subtext}`}>
          You&apos;ve reached the {label.toLowerCase()} limit on your plan.
          Close an existing one or upgrade to add more.
        </p>
      )}
    </div>
  );
}
