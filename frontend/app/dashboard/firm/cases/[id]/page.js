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
      {/* viewedAsFirmAdmin tells CaseDetail to bypass the
          individual-pro lock on firm cases — anyone reaching this route
          is acting as a firm admin (the legacy 'professional' role users
          can also own a firm). */}
      <CaseDetail caseId={id} viewedAsFirmAdmin />
    </DashboardLayout>
  );
}
