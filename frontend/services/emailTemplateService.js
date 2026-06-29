// emailTemplateService — admin wrapper over /api/admin/email-templates.
// Lists trigger points, fetches the editable subject + body for one
// trigger, saves changes, previews the rendered HTML / text, and sends
// a one-off test message.

import { get, put, post, del } from '@/services/api';

function unwrap(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

export async function listEmailTemplates() {
  const res = await get('/api/admin/email-templates');
  const data = unwrap(res);
  return (data && data.items) || [];
}

export async function getEmailTemplate(key) {
  const res = await get(`/api/admin/email-templates/${encodeURIComponent(key)}`);
  const data = unwrap(res);
  return data && data.item ? data.item : data;
}

export async function saveEmailTemplate(key, payload) {
  const res = await put(`/api/admin/email-templates/${encodeURIComponent(key)}`, payload);
  return unwrap(res);
}

export async function resetEmailTemplate(key) {
  const res = await del(`/api/admin/email-templates/${encodeURIComponent(key)}`);
  return unwrap(res);
}

export async function previewEmailTemplate(key, vars) {
  const res = await post(
    `/api/admin/email-templates/${encodeURIComponent(key)}/preview`,
    { vars: vars || {} }
  );
  return unwrap(res);
}

export async function testEmailTemplate(key, { to, vars }) {
  const res = await post(
    `/api/admin/email-templates/${encodeURIComponent(key)}/test`,
    { to, vars: vars || {} }
  );
  return unwrap(res);
}
