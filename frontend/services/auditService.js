// Audit log read API — wraps /api/audit/:entityType/:entityId.

import { get } from '@/services/api';

function unwrap(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

export async function listForEntity(entityType, entityId, { limit = 200 } = {}) {
  const res = await get(
    `/api/audit/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
    { params: { limit } }
  );
  const data = unwrap(res);
  return Array.isArray(data) ? data : [];
}
