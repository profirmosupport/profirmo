'use client';

// Admin — Case types. Thin wrapper over the shared
// LookupTableAdminPage. Case-type values are case-sensitive (the
// partner taxonomy mixes uppercase codes like CC with mixed-case
// ones like Arb, MCrA, Tax_Ref), so the normaliser here preserves
// case — different from case statuses, which uppercase.

import LookupTableAdminPage from '@/components/admin/LookupTableAdminPage';
import {
  adminListCaseTypes,
  adminCreateCaseType,
  adminUpdateCaseType,
  adminDeleteCaseType,
} from '@/services/appSettingsService';

function normalizeValue(raw) {
  return String(raw || '')
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const service = {
  list: () => adminListCaseTypes(),
  create: (data) => adminCreateCaseType(data),
  update: (id, data) => adminUpdateCaseType(id, data),
  remove: (id) => adminDeleteCaseType(id),
};

export default function AdminCaseTypesPage() {
  return (
    <LookupTableAdminPage
      title="Case types"
      subtitle="Manage the court case-type enum used by Cases and E-Courts."
      itemLabel="case type"
      service={service}
      normalizeValue={normalizeValue}
      valuePlaceholder="e.g. WP_C  or  Arb_Pet"
    />
  );
}
