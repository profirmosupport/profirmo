'use client';

// /admin/subscriptions/new — thin wrapper around SubscriptionPlanForm.
// Routes to /admin/subscriptions/[id]/edit on save so the admin can keep
// tuning the new plan in one continuous flow.

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Button from '@/components/common/Button';
import SubscriptionPlanForm from '@/components/admin/SubscriptionPlanForm';
import { ROLES } from '@/utils/constants';

export default function NewSubscriptionPlanPage() {
  const router = useRouter();
  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="New subscription plan"
      subtitle="Define a tier professionals can subscribe to."
    >
      <div className="space-y-4">
        <Button href="/admin/subscriptions" variant="outline" size="sm">
          <ArrowLeft size={15} />
          Back to plans
        </Button>
        <SubscriptionPlanForm
          onSaved={(saved) => {
            if (saved && saved.id) {
              router.push(`/admin/subscriptions/${saved.id}/edit`);
            }
          }}
        />
      </div>
    </DashboardLayout>
  );
}
