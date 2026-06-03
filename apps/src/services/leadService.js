import { apiPost, unwrap } from './api';

// leadService — public lead-capture submit. Mirrors the web's
// `submitLead()` so the firm-profile contact form on mobile creates
// the SAME Lead row that the web does (visible to the firm in their
// dashboard and to admins under /admin/leads).

export async function submitLead({
  fullName,
  email,
  phone,
  source,
  message,
  firmId,
}) {
  const res = await apiPost('/api/leads', {
    fullName,
    email,
    phone,
    source,
    message,
    firmId,
  });
  return unwrap(res);
}
