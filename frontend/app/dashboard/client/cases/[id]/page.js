'use client';

import { use } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import CaseDetail from '@/components/cases/CaseDetail';
import { ROLES } from '@/utils/constants';

export default function ClientCaseDetailPage({ params }) {
  // Next.js 15 — params is a thenable; use `use()` to unwrap it.
  const { id } = use(params);

  return (
    <DashboardLayout
      role={ROLES.CLIENT}
      title="Case details"
      subtitle="Notes and status for your case"
    >
      <CaseDetail caseId={id} />
    </DashboardLayout>
  );
}
