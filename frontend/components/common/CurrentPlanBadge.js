'use client';

// CurrentPlanBadge — small clickable pill next to the profile dropdown.
// Shows the authenticated professional's current plan name and routes to
// the subscription page. Renders nothing for clients, firm-admins, etc.
//
// The plan is fetched once per session and cached in module state — every
// header instance reads from the same cache, and after a successful
// upgrade the subscription page can call `refreshCurrentPlanBadge()` to
// invalidate.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, ChevronRight } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getMySubscription } from '@/services/subscriptionService';

let cached = null;
let pending = null;

export function refreshCurrentPlanBadge() {
  cached = null;
  pending = null;
}

async function loadOnce() {
  if (cached) return cached;
  if (pending) return pending;
  pending = (async () => {
    try {
      const sub = await getMySubscription();
      cached = sub;
      return sub;
    } catch {
      cached = null;
      return null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

export default function CurrentPlanBadge({ compact = false }) {
  const { user, isAuthenticated, loading } = useAuth();
  const [sub, setSub] = useState(cached);

  // Professionals + firm admins see the plan badge (both can subscribe).
  // Clients / platform admins / signed-out users don't — skip the fetch
  // to keep page loads quiet.
  const role = user && user.role;
  const showsBadge =
    role === 'professional' ||
    role === 'firm_admin' ||
    role === 'firm_professional' ||
    role === 'firm';

  useEffect(() => {
    if (loading || !isAuthenticated || !showsBadge) return;
    let active = true;
    loadOnce().then((s) => {
      if (active) setSub(s);
    });
    return () => {
      active = false;
    };
  }, [loading, isAuthenticated, showsBadge]);

  if (loading || !isAuthenticated || !showsBadge) return null;
  const plan = sub && sub.plan;
  if (!plan) return null;

  return (
    <Link
      href="/dashboard/professional/subscription"
      title={`You're on the ${plan.name}. Click to manage your subscription.`}
      className="group inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/70 px-2.5 py-1 text-xs font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100"
    >
      <Star size={12} className="text-amber-600" />
      {compact ? (
        <span className="hidden sm:inline">{plan.name}</span>
      ) : (
        <span>{plan.name}</span>
      )}
      <ChevronRight
        size={12}
        className="text-amber-500 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
