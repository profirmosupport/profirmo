'use client';

import { use } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import CaseDetail from '@/components/cases/CaseDetail';
import { ROLES } from '@/utils/constants';

export default function ProfessionalCaseDetailPage({ params }) {
  // Next.js 15 — params is a thenable; use `use()` to unwrap it.
  const { id } = use(params);

  return (
    <DashboardLayout
      role={ROLES.PROFESSIONAL}
      title="Case details"
      subtitle="Manage notes, status and activity for this case"
    >
      <CaseDetail caseId={id} />
    </DashboardLayout>
  );
}
