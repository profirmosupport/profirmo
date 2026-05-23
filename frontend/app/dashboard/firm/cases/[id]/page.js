'use client';

import { use } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import CaseDetail from '@/components/cases/CaseDetail';
import { ROLES } from '@/utils/constants';

export default function FirmCaseDetailPage({ params }) {
  const { id } = use(params);

  return (
    <DashboardLayout
      role={ROLES.FIRM_ADMIN}
      title="Case details"
      subtitle="Manage notes, status and activity for this case"
    >
      <CaseDetail caseId={id} />
    </DashboardLayout>
  );
}
