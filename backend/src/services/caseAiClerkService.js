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

/**
 * Gate AI access to professionals on a paid plan. Slugs treated as
 * paid: anything other than 'starter' (or no subscription at all).
 * Admins always pass. Throws 402 with a friendly upgrade prompt so
 * the frontend can surface it.
 */
const PAID_SLUGS = new Set(['premium', 'team', 'custom']);

async function assertPremium(userId) {
  if (!userId) {
    throw { statusCode: 401, message: 'Sign in to use the AI Clerk.' };
  }
  // eslint-disable-next-line global-require
  const { User, ProfessionalSubscription, SubscriptionPlan } = require('../models');
  const user = await User.findByPk(userId, {
    attributes: ['id', 'role'],
    raw: true,
  });
  if (!user) {
    throw { statusCode: 401, message: 'Account not found.' };
  }
  // Admins always have access (operational convenience).
  if (String(user.role || '').toLowerCase() === 'platform_admin') return;

  const sub = await ProfessionalSubscription.findOne({
    where: { userId, status: 'active' },
    raw: true,
  });
  if (!sub) {
    throw {
      statusCode: 402,
      message:
        'AI Clerk is available on the Premium, Team and Custom plans. Upgrade your subscription to unlock it.',
      code: 'AI_PREMIUM_REQUIRED',
    };
  }
  const plan = await SubscriptionPlan.findByPk(sub.planId, {
    attributes: ['slug'],
    raw: true,
  });
  if (!plan || !PAID_SLUGS.has(String(plan.slug).toLowerCase())) {
    throw {
      statusCode: 402,
      message:
        'AI Clerk requires a Premium, Team or Custom plan. Upgrade to unlock it.',
      code: 'AI_PREMIUM_REQUIRED',
    };
  }
}

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
  await assertPremium(userId);
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

async function suggestNextStep(caseId, userId) {
  await assertPremium(userId);
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

/**
 * Analyse a document (PDF or image) attached to this case's client.
 * Fetches the file from S3 via storageService, base64-encodes it
 * and passes it through Claude as a document/image content block.
 * Returns a structured analysis: key facts, dates, amounts, parties,
 * deadlines and red flags. PDF + common image types only — DOC/DOCX
 * 415s with a "convert to PDF first" message.
 */
async function analyseDocument(caseId, userId, documentId) {
  await assertPremium(userId);
  if (!documentId) {
    throw { statusCode: 422, message: 'documentId is required.' };
  }
  // eslint-disable-next-line global-require
  const { ClientDocument, Case } = require('../models');
  const doc = await ClientDocument.findOne({
    where: { id: documentId },
    raw: true,
  });
  if (!doc) throw { statusCode: 404, message: 'Document not found.' };

  // Ensure the document belongs to a client on this case.
  const caseRow = await Case.findByPk(caseId, { raw: true });
  if (!caseRow) throw { statusCode: 404, message: 'Case not found.' };
  const caseClientIds = [];
  if (caseRow.clientId) caseClientIds.push(caseRow.clientId);
  if (Array.isArray(caseRow.clientIds)) for (const id of caseRow.clientIds) if (id) caseClientIds.push(id);
  if (!caseClientIds.includes(doc.clientUserId)) {
    throw {
      statusCode: 403,
      message: 'Document does not belong to a client on this case.',
    };
  }

  // Pull the file off S3 / local disk. storageService exposes a
  // download helper that returns a buffer + metadata.
  // eslint-disable-next-line global-require
  const storageService = require('./storageService');
  let buffer;
  let mimeType = doc.mimeType || 'application/octet-stream';
  try {
    // Most storage drivers expose getFile(path) returning { buffer, mimeType }.
    if (typeof storageService.getFileBuffer === 'function') {
      const out = await storageService.getFileBuffer(doc.storagePath);
      buffer = out.buffer;
      mimeType = out.mimeType || mimeType;
    } else {
      // Fallback: fetch the presigned URL ourselves.
      const url = await storageService.getFileUrl(doc.storagePath, {
        expiryMinutes: 5,
      });
      const r = await fetch(url);
      if (!r.ok) throw new Error(`storage fetch failed (${r.status})`);
      buffer = Buffer.from(await r.arrayBuffer());
    }
  } catch (err) {
    throw {
      statusCode: 502,
      message: `Could not download document for analysis: ${err.message || err}`,
    };
  }

  // Claude /v1/messages supports PDF and image content blocks. Cap
  // at ~10 MB; we already enforce 1 MB at upload time so this is
  // belt-and-braces.
  const TEN_MB = 10 * 1024 * 1024;
  if (buffer.length > TEN_MB) {
    throw { statusCode: 413, message: 'Document too large for AI analysis.' };
  }

  const isPdf = /pdf$/i.test(mimeType) || /\.pdf$/i.test(doc.fileName || '');
  const isImage = /^image\//i.test(mimeType);
  if (!isPdf && !isImage) {
    throw {
      statusCode: 415,
      message:
        'AI analysis supports PDF and image files only for now. Convert this document to PDF before retrying.',
    };
  }

  const { apiKey, model } = await getClient();
  const base64 = buffer.toString('base64');
  const contentBlock = isPdf
    ? {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      }
    : {
        type: 'image',
        source: { type: 'base64', media_type: mimeType, data: base64 },
      };

  const userTextBlock = {
    type: 'text',
    text:
      `Analyse the attached ${isPdf ? 'PDF' : 'image'} (filename: ${doc.fileName || doc.docKey}).\n\n` +
      'Return a structured summary covering:\n' +
      '  * Document type + purpose (one line)\n' +
      '  * Key parties / signatories\n' +
      '  * Important dates + deadlines\n' +
      '  * Amounts / values\n' +
      '  * Notable clauses, obligations, or risks\n' +
      '  * Anything missing or unclear that the professional should follow up on\n\n' +
      'Be concise; bullet points fine. Do not invent facts.',
  };

  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [contentBlock, userTextBlock],
        },
      ],
    }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const detail =
      (json.error && (json.error.message || json.error.type)) ||
      `HTTP ${resp.status}`;
    throw {
      statusCode: 502,
      message: `Claude analysis failed: ${detail}`,
    };
  }
  const blocks = Array.isArray(json.content) ? json.content : [];
  const text = blocks
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return {
    analysis: text,
    fileName: doc.fileName,
    docKey: doc.docKey,
    mimeType,
  };
}

/**
 * Analyse a one-off uploaded file (the user pastes / drops a doc
 * in the AI Clerk's Analyse-document tile without first storing it
 * against the client). Caller passes the file buffer directly; we
 * forward to Claude without ever persisting it. Claude's native
 * document/image blocks handle OCR for us — no separate Tesseract
 * step needed.
 */
async function analyseUploadedDocument(caseId, userId, file) {
  await assertPremium(userId);
  if (!file || !file.buffer) {
    throw { statusCode: 422, message: 'No file received.' };
  }
  const mimeType = file.mimetype || 'application/octet-stream';
  const isPdf = /pdf$/i.test(mimeType) || /\.pdf$/i.test(file.originalname || '');
  const isImage = /^image\//i.test(mimeType);
  if (!isPdf && !isImage) {
    throw {
      statusCode: 415,
      message:
        'Upload a PDF or image (PNG/JPG/WEBP). DOC/DOCX is not supported by the AI document pipeline — convert to PDF first.',
    };
  }
  // Re-use the same 10 MB ceiling as the linked-doc analyser.
  const TEN_MB = 10 * 1024 * 1024;
  if (file.size && file.size > TEN_MB) {
    throw { statusCode: 413, message: 'File too large — keep under 10 MB.' };
  }
  const { apiKey, model } = await getClient();
  const base64 = Buffer.from(file.buffer).toString('base64');
  const contentBlock = isPdf
    ? {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      }
    : {
        type: 'image',
        source: { type: 'base64', media_type: mimeType, data: base64 },
      };
  const textBlock = {
    type: 'text',
    text:
      `OCR + analyse the attached ${isPdf ? 'PDF' : 'image'} (filename: ${file.originalname || 'upload'}).\n\n` +
      'Return a structured summary covering:\n' +
      '  * Document type + purpose (one line)\n' +
      '  * Key parties / signatories\n' +
      '  * Important dates + deadlines\n' +
      '  * Amounts / values\n' +
      '  * Notable clauses, obligations, or risks\n' +
      '  * Anything unclear that the professional should follow up on\n\n' +
      'Be concise; bullet points fine. Do not invent facts.',
  };
  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      messages: [{ role: 'user', content: [contentBlock, textBlock] }],
    }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const detail =
      (json.error && (json.error.message || json.error.type)) ||
      `HTTP ${resp.status}`;
    throw { statusCode: 502, message: `Claude analysis failed: ${detail}` };
  }
  const blocks = Array.isArray(json.content) ? json.content : [];
  const text = blocks
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return { analysis: text, fileName: file.originalname || null, mimeType };
}

async function prompt(caseId, instruction, userId) {
  await assertPremium(userId);
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
  analyseDocument,
  analyseUploadedDocument,
  buildCaseContext, // exported for testing
};
