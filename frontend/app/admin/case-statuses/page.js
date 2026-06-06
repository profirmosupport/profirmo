'use client';

// Admin — Case statuses. Thin wrapper over the shared
// LookupTableAdminPage; all UI lives there.

import LookupTableAdminPage from '@/components/admin/LookupTableAdminPage';
import {
  adminListCaseStatuses,
  adminCreateCaseStatus,
  adminUpdateCaseStatus,
  adminDeleteCaseStatus,
} from '@/services/appSettingsService';

// Uppercase + underscores — mirrors the backend's normaliser so the
// modal preview stays in sync with what the server will persist.
function normalizeValue(raw) {
  return String(raw || '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const service = {
  list: () => adminListCaseStatuses(),
  create: (data) => adminCreateCaseStatus(data),
  update: (id, data) => adminUpdateCaseStatus(id, data),
  remove: (id) => adminDeleteCaseStatus(id),
};

export default function AdminCaseStatusesPage() {
  return (
    <LookupTableAdminPage
      title="Case statuses"
      subtitle="Manage the court case status enum used by Cases and E-Courts."
      itemLabel="case status"
      service={service}
      normalizeValue={normalizeValue}
      valuePlaceholder="e.g. PARTLY_DISMISSED"
    />
  );
}
