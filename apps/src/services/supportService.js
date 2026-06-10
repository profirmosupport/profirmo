// Support / contact form service. Mirrors the web's /contact form
// submission — same endpoint, same payload shape, server-side
// validation + email notification logic shared between surfaces.

import { apiPost, unwrap } from './api';

export async function submitContact({ name, email, subject, message }) {
  const res = await apiPost('/api/support/contact', {
    name: String(name || '').trim(),
    email: String(email || '').trim(),
    subject: String(subject || '').trim(),
    message: String(message || '').trim(),
  });
  return unwrap(res);
}
