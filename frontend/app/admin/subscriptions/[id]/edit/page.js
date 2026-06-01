'use client';

// /admin/subscriptions/[id]/edit — load existing plan, render the editor,
// re-load on save so the feature-rules grid stays in sync with what the
// backend just persisted.

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, AlertTriangle, Users } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import SubscriptionPlanForm from '@/components/admin/SubscriptionPlanForm';
import { adminGetPlan } from '@/services/subscriptionService';
import { ROLES } from '@/utils/constants';

export default function EditSubscriptionPlanPage() {
  const params = useParams();
  const id = params && params.id;
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const p = await adminGetPlan(id);
      setPlan(p);
    } catch (err) {
      setError(err.message || 'Could not load this plan.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title={plan ? `Edit · ${plan.name}` : 'Edit plan'}
      subtitle={
        plan
          ? `${plan.activeSubscriberCount || 0} active subscribers on this plan.`
          : 'Loading plan…'
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button href="/admin/subscriptions" variant="outline" size="sm">
            <ArrowLeft size={15} />
            Back to plans
          </Button>
          {plan && (
            <Button
              href={`/admin/subscriptions/${plan.id}/subscribers`}
              variant="outline"
              size="sm"
            >
              <Users size={15} />
              View subscribers ({plan.activeSubscriberCount || 0})
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-64 w-full animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : error ? (
          <Card>
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle size={22} />
              </span>
              <p className="text-sm font-medium text-slate-700">{error}</p>
              <Button size="sm" onClick={load}>
                Try again
              </Button>
            </div>
          </Card>
        ) : plan ? (
          <SubscriptionPlanForm plan={plan} onSaved={load} />
        ) : null}
      </div>
    </DashboardLayout>
  );
}
