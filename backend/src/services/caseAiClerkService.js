// caseAiClerkService — per-case AI assistant. Calls Claude /v1/messages
// with a structured case context (header + clients + professionals +
// notes + updates + tasks) and returns:
//   * summarize(caseId, userId) — 6-10 sentence narrative summary
//     persisted on Case.aiSummary so subsequent page loads don't
//     re-burn tokens. Regenerate is one button click.
//   * suggestNextStep(caseId, userId) — short "what to do next"
//     prompt grounded in the existing summary + activity log.
//   * prompt(caseId, userId, instruction) — free-form help (drafting
//     applications, replying to notices, etc.). Caller may then
//     persist the response as a CaseUpdate via saveAsUpdate().
//
// Keys + model live in admin_settings (`claude_api_key`,
// `claude_model`) so an admin can rotate without redeploying. If the
// key is missing every method throws 503 with a clear message —
// useful so the UI can render an "AI offline" hint.

const adminSettings = require('./adminSettingsService');
const {
  Case,
  CaseNote,
  CaseUpdate,
  CaseLog,
  User,
  ProfessionalDetail,
} = require('../models');
const { Op } = require('sequelize');

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_OUTPUT_TOKENS = 1024;

async function getClient() {
  const [apiKey, model] = await Promise.all([
    adminSettings.getString('claude_api_key'),
    adminSettings.getString('claude_model'),
  ]);
  if (!apiKey) {
    throw {
      statusCode: 503,
      message:
        'Claude API key not configured. Set claude_api_key under Admin → AI / Anthropic.',
    };
  }
  return { apiKey, model: model || 'claude-sonnet-4-6' };
}

/**
 * Pull together every piece of structured information about a case
 * into a single prompt-friendly string. Order matters — the more
 * recent / current state goes first so the model leads with what's
 * happening *now*; history goes after.
 */
async function buildCaseContext(caseId) {
  const c = await Case.findByPk(caseId, { raw: true });
  if (!c) throw { statusCode: 404, message: 'Case not found.' };

  // Client + professional display names (best-effort — no failure
  // propagates here; missing data just shows up as 'Unknown').
  const clientIds = [];
  if (c.clientId) clientIds.push(c.clientId);
  if (Array.isArray(c.clientIds)) for (const id of c.clientIds) if (id && !clientIds.includes(id)) clientIds.push(id);
  const clientUsers = clientIds.length
    ? await User.findAll({
        where: { id: { [Op.in]: clientIds } },
        attributes: ['id', 'name', 'fullName', 'email'],
        raw: true,
      })
    : [];

  const proIds = [];
  if (c.professionalId) proIds.push(c.professionalId);
  if (Array.isArray(c.professionalIds))
    for (const id of c.professionalIds) if (id && !proIds.includes(id)) proIds.push(id);
  let proNames = [];
  if (proIds.length) {
    const details = await ProfessionalDetail.findAll({
      where: { id: { [Op.in]: proIds } },
      attributes: ['userId'],
      raw: true,
    });
    if (details.length) {
      const userIds = details.map((d) => d.userId).filter(Boolean);
      const proUsers = await User.findAll({
        where: { id: { [Op.in]: userIds } },
        attributes: ['name', 'fullName'],
        raw: true,
      });
      proNames = proUsers.map((u) => u.fullName || u.name || 'Professional');
    }
  }

  const notes = await CaseNote.findAll({
    where: { caseId },
    order: [['createdAt', 'DESC']],
    limit: 30,
    raw: true,
  });
  const updates = await CaseUpdate.findAll({
    where: { caseId },
    order: [['scheduledAt', 'DESC']],
    limit: 40,
    raw: true,
  });
  const log = await CaseLog.findAll({
    where: { caseId },
    order: [['createdAt', 'DESC']],
    limit: 50,
    raw: true,
  });

  const lines = [];
  lines.push('# CASE');
  lines.push(`Title: ${c.title || '(untitled)'}`);
  if (c.caseNumber) lines.push(`Case number: ${c.caseNumber}`);
  if (c.category) lines.push(`Category: ${c.category}`);
  if (c.stage) lines.push(`Stage: ${c.stage}`);
  if (c.priority) lines.push(`Priority: ${c.priority}`);
  if (c.courtName) lines.push(`Court / authority: ${c.courtName}`);
  if (c.opposingParty) lines.push(`Opposing party: ${c.opposingParty}`);
  if (c.nextHearingDate) lines.push(`Next hearing: ${c.nextHearingDate}`);

  lines.push('');
  lines.push('# PARTIES');
  if (clientUsers.length) {
    for (const u of clientUsers) {
      lines.push(`Client: ${u.fullName || u.name || 'Unknown'}${u.email ? ` <${u.email}>` : ''}`);
    }
  } else {
    lines.push('Client: (none on file)');
  }
  if (proNames.length) {
    for (const n of proNames) lines.push(`Professional: ${n}`);
  }

  if (updates.length) {
    lines.push('');
    lines.push('# RECENT UPDATES (newest first)');
    for (const u of updates) {
      const stamp = (u.scheduledAt && new Date(u.scheduledAt).toISOString().slice(0, 10)) || '';
      const title = u.title ? `[${u.title}] ` : '';
      const body = (u.body || '').slice(0, 600).replace(/\s+/g, ' ').trim();
      const taskBits = [];
      if (u.status) taskBits.push(`task=${u.status}`);
      if (u.dueDate) taskBits.push(`due=${u.dueDate}`);
      if (u.priority && u.priority !== 'normal') taskBits.push(`prio=${u.priority}`);
      const tail = taskBits.length ? ` (${taskBits.join(', ')})` : '';
      lines.push(`- ${stamp} ${title}${body}${tail}`);
    }
  }

  if (notes.length) {
    lines.push('');
    lines.push('# NOTES (newest first)');
    for (const n of notes) {
      const stamp = (n.createdAt && new Date(n.createdAt).toISOString().slice(0, 10)) || '';
      const body = (n.content || n.body || '').slice(0, 500).replace(/\s+/g, ' ').trim();
      lines.push(`- ${stamp} ${body}`);
    }
  }

  if (log.length) {
    lines.push('');
    lines.push('# ACTIVITY LOG (newest first, terse)');
    for (const l of log) {
      const stamp = (l.createdAt && new Date(l.createdAt).toISOString().slice(0, 10)) || '';
      lines.push(`- ${stamp} ${l.action || ''}: ${(l.message || '').slice(0, 200)}`);
    }
  }

  return { context: lines.join('\n'), caseRow: c };
}

/**
 * Call Claude with a system prompt + user message. Returns the
 * concatenated assistant text. Throws on non-200 with a friendly
 * message so the controller can surface it.
 */
async function callClaude({ system, userMessage, maxTokens = MAX_OUTPUT_TOKENS }) {
  const { apiKey, model } = await getClient();
  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const detail =
      (json.error && (json.error.message || json.error.type)) ||
      `HTTP ${resp.status}`;
    throw {
      statusCode: 502,
      message: `Claude API error: ${detail}`,
    };
  }
  const blocks = Array.isArray(json.content) ? json.content : [];
  const text = blocks
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return { text, model, usage: json.usage || null };
}

// --- Public surface --------------------------------------------------

async function summarize(caseId, userId) {
  const { context, caseRow } = await buildCaseContext(caseId);
  const { text } = await callClaude({
    system:
      'You are an experienced legal + tax case manager. Summarise the case in 6-10 sentences for the assigned professional. Cover: what the matter is, who the parties are, where it currently stands, what has happened recently, and any deadlines. Do not invent facts not in the data.',
    userMessage: context,
  });
  await Case.update(
    {
      aiSummary: text,
      aiSummaryUpdatedAt: new Date(),
      aiSummaryByUserId: userId || null,
    },
    { where: { id: caseId } }
  );
  return {
    summary: text,
    updatedAt: new Date(),
    caseTitle: caseRow.title || null,
  };
}

async function suggestNextStep(caseId) {
  const { context, caseRow } = await buildCaseContext(caseId);
  const grounding =
    caseRow.aiSummary
      ? `EXISTING SUMMARY:\n${caseRow.aiSummary}\n\n---\n${context}`
      : context;
  const { text } = await callClaude({
    system:
      'You are advising the professional on what to do next on this case. Suggest 3-5 concrete next steps in priority order. Each step should be a single sentence, action-oriented, and reference dates / parties / documents from the case data. Mention any deadline you can derive. No filler.',
    userMessage: grounding,
    maxTokens: 700,
  });
  return { suggestion: text };
}

async function prompt(caseId, instruction) {
  if (!instruction || !String(instruction).trim()) {
    throw { statusCode: 422, message: 'Please describe what you want help with.' };
  }
  const { context } = await buildCaseContext(caseId);
  const { text } = await callClaude({
    system:
      'You are drafting on behalf of the assigned professional. Use the case data below as the only ground truth. Match Indian legal / tax drafting conventions where applicable. Keep tone professional and concise. If asked to write a document, return ONLY the document body — no preamble, no markdown headings.',
    userMessage: `CASE DATA:\n${context}\n\nINSTRUCTION FROM PROFESSIONAL:\n${String(instruction).trim()}`,
    maxTokens: 1200,
  });
  return { response: text };
}

module.exports = {
  summarize,
  suggestNextStep,
  prompt,
  buildCaseContext, // exported for testing
};
