'use client';

// Admin — Cause list types. Thin wrapper over the shared
// LookupTableAdminPage. Same uppercase-and-underscore normaliser as
// case statuses — the tiny seed enum (CIVIL / CRIMINAL / UNKNOWN) is
// all uppercase by convention.

import LookupTableAdminPage from '@/components/admin/LookupTableAdminPage';
import {
  adminListCauseListTypes,
  adminCreateCauseListType,
  adminUpdateCauseListType,
  adminDeleteCauseListType,
} from '@/services/appSettingsService';

function normalizeValue(raw) {
  return String(raw || '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const service = {
  list: () => adminListCauseListTypes(),
  create: (data) => adminCreateCauseListType(data),
  update: (id, data) => adminUpdateCauseListType(id, data),
  remove: (id) => adminDeleteCauseListType(id),
};

export default function AdminCauseListTypesPage() {
  return (
    <LookupTableAdminPage
      title="Cause list types"
      subtitle="Categorise daily cause-list rows (civil vs criminal)."
      itemLabel="cause list type"
      service={service}
      normalizeValue={normalizeValue}
      valuePlaceholder="e.g. CIVIL"
    />
  );
}
