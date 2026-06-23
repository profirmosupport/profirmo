// caseAiService — frontend wrapper for /api/cases/:id/ai/*. Drives
// the floating AI Clerk panel on the case detail page.

import { post } from '@/services/api';

function unwrap(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

export async function summarizeCase(caseId) {
  const res = await post(
    `/api/cases/${encodeURIComponent(caseId)}/ai/summarize`,
    {}
  );
  return unwrap(res);
}

export async function suggestNextStep(caseId) {
  const res = await post(
    `/api/cases/${encodeURIComponent(caseId)}/ai/suggest-next-step`,
    {}
  );
  return unwrap(res);
}

export async function aiPrompt(caseId, instruction) {
  const res = await post(
    `/api/cases/${encodeURIComponent(caseId)}/ai/prompt`,
    { instruction }
  );
  return unwrap(res);
}

export async function saveAiResponseAsUpdate(caseId, { title, body }) {
  const res = await post(
    `/api/cases/${encodeURIComponent(caseId)}/ai/save-as-update`,
    { title, body }
  );
  return unwrap(res);
}
