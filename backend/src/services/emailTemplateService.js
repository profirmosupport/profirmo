// emailTemplateService — DB-aware wrapper over src/emails/templates.js.
//
// The hardcoded TEMPLATES registry stays the single source of truth for
// MARKUP — admins customise via the EmailTemplate table, which stores
// the rendered subject + HTML + text with {{var}} placeholders the
// renderer substitutes at send time. Falls back to the hardcoded
// template when no DB row exists (or the row is `enabled = false`), so
// a fresh deployment works with zero seeded rows.

const { renderTemplate } = require('../emails/templates');
const EmailTemplate = require('../models/EmailTemplate');

// Canonical catalog of every email the system can send. Each entry
// matches a key in src/emails/templates.js and documents:
//   - label:       human-readable name shown in the admin list
//   - trigger:     when this email fires
//   - audience:    who receives it (client / professional / admin)
//   - variables:   placeholder names available to {{var}} substitution
//
// Editing this list does NOT change runtime behaviour — it's metadata
// for the admin UI + the seed step that copies the hardcoded templates
// into the DB.
const TRIGGERS = [
  {
    key: 'emailVerification',
    label: 'Email verification',
    trigger: 'Sent during signup (or on Resend) to confirm the email address.',
    audience: 'New signups (clients + professionals)',
    variables: ['name', 'verifyUrl', 'expiryHours'],
  },
  {
    key: 'clientInvitation',
    label: 'Client invitation',
    trigger: 'Professional invites an existing or new client to claim their account.',
    audience: 'Invited clients',
    variables: ['clientName', 'professionalName', 'inviteUrl', 'expiryDays'],
  },
  {
    key: 'professionalApproval',
    label: 'Professional approved',
    trigger: 'Admin approves a professional signup application.',
    audience: 'Professional applicant',
    variables: ['name', 'dashboardUrl', 'professionalType'],
  },
  {
    key: 'professionalRejection',
    label: 'Professional rejected',
    trigger: 'Admin rejects a professional signup application.',
    audience: 'Professional applicant',
    variables: ['name', 'reason', 'supportEmail'],
  },
  {
    key: 'professionalInfoRequest',
    label: 'Professional — info requested',
    trigger: 'Admin asks the professional for more documents / clarification.',
    audience: 'Professional applicant',
    variables: ['name', 'message', 'resumeUrl'],
  },
  {
    key: 'newProfessionalRegistration',
    label: 'New professional signup (admin alert)',
    trigger: 'A new professional has just completed signup.',
    audience: 'Platform admin',
    variables: ['name', 'email', 'professionalType', 'reviewUrl'],
  },
  {
    key: 'firmApproval',
    label: 'Firm approved',
    trigger: 'Admin approves a law-firm application.',
    audience: 'Firm owner',
    variables: ['firmName', 'ownerName', 'dashboardUrl'],
  },
  {
    key: 'firmRejection',
    label: 'Firm rejected',
    trigger: 'Admin rejects a law-firm application.',
    audience: 'Firm owner',
    variables: ['firmName', 'ownerName', 'reason', 'supportEmail'],
  },
  {
    key: 'firmModificationsRequested',
    label: 'Firm — modifications requested',
    trigger: 'Admin asks the firm owner to fix the application before approval.',
    audience: 'Firm owner',
    variables: ['firmName', 'ownerName', 'message', 'editUrl'],
  },
  {
    key: 'firmInvitation',
    label: 'Firm invitation',
    trigger: 'Firm owner / co-owner invites a professional to join the firm.',
    audience: 'Invited professional',
    variables: ['firmName', 'invitedName', 'inviterName', 'inviteUrl', 'expiryDays'],
  },
  {
    key: 'newFirmRegistration',
    label: 'New firm signup (admin alert)',
    trigger: 'A new law firm has just completed signup.',
    audience: 'Platform admin',
    variables: ['firmName', 'ownerName', 'ownerEmail', 'reviewUrl'],
  },
  {
    key: 'passwordResetOtp',
    label: 'Password reset OTP',
    trigger: 'User starts the forgot-password flow.',
    audience: 'Any signed-up user',
    variables: ['name', 'otp', 'expiryMinutes'],
  },
  {
    key: 'passwordChanged',
    label: 'Password changed',
    trigger: 'User has successfully changed their password.',
    audience: 'Any signed-up user',
    variables: ['name', 'supportEmail'],
  },
  {
    key: 'paymentReceipt',
    label: 'Payment receipt',
    trigger: 'Razorpay confirms a booking payment is captured.',
    audience: 'Paying client',
    variables: [
      'clientName',
      'professionalName',
      'amount',
      'currency',
      'dateTime',
      'duration',
      'razorpayPaymentId',
      'bookingId',
    ],
  },
];

const TRIGGER_BY_KEY = new Map(TRIGGERS.map((t) => [t.key, t]));

function isKnownKey(key) {
  return TRIGGER_BY_KEY.has(key);
}

// Replace every {{var}} occurrence with the matching value from `vars`.
// Missing values render as empty string so a malformed template never
// emits an obvious `{{verifyUrl}}` placeholder into the recipient's
// inbox. Keys are matched case-sensitive; whitespace inside braces is
// tolerated (`{{ name }}` works just like `{{name}}`).
function interpolate(template, vars) {
  if (!template) return '';
  return String(template).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name) => {
    const v = vars && Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : '';
    return v == null ? '' : String(v);
  });
}

// Build the placeholder-substituted output from a hardcoded template
// function. Used by the seed step + admin "Reset to default" action.
// Each variable is replaced with its mustache placeholder string so the
// rendered HTML carries `{{name}}` markers instead of "there".
function buildPlaceholderRendering(key) {
  const trigger = TRIGGER_BY_KEY.get(key);
  if (!trigger) return null;
  const placeholderVars = {};
  for (const name of trigger.variables || []) {
    placeholderVars[name] = `{{${name}}}`;
  }
  const rendered = renderTemplate(key, placeholderVars);
  return rendered;
}

// Lookup-and-render entry point. Mirrors emails/templates.js
// renderTemplate signature so it can be a drop-in replacement.
async function renderForSend(key, vars = {}) {
  if (!isKnownKey(key)) {
    // Pass through to the hardcoded renderer — keeps any not-yet-
    // catalogued template working.
    return renderTemplate(key, vars);
  }
  let row = null;
  try {
    row = await EmailTemplate.findByPk(key, { raw: true });
  } catch {
    row = null;
  }
  if (row && row.enabled && row.subject && row.htmlBody) {
    return {
      subject: interpolate(row.subject, vars),
      html: interpolate(row.htmlBody, vars),
      text: interpolate(row.textBody || '', vars) || undefined,
    };
  }
  return renderTemplate(key, vars);
}

// Admin list: every catalog entry + (if present) its DB row metadata.
async function listForAdmin() {
  const rows = await EmailTemplate.findAll({ raw: true });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return TRIGGERS.map((trigger) => {
    const row = byKey.get(trigger.key) || null;
    return {
      ...trigger,
      hasCustom: !!row,
      enabled: row ? !!row.enabled : true,
      updatedAt: row ? row.updatedAt : null,
      updatedByUserId: row ? row.updatedByUserId : null,
    };
  });
}

// Single template + its body for the admin editor.
async function getForAdmin(key) {
  if (!isKnownKey(key)) {
    throw { statusCode: 404, message: `Unknown template: ${key}` };
  }
  const trigger = TRIGGER_BY_KEY.get(key);
  const row = await EmailTemplate.findByPk(key, { raw: true });
  // When no custom row exists, return the placeholder-substituted
  // default so the admin editor opens pre-filled with the current
  // hardcoded body — making "tweak this one line" the path of least
  // resistance.
  const defaultRender = buildPlaceholderRendering(key);
  return {
    ...trigger,
    hasCustom: !!row,
    enabled: row ? !!row.enabled : true,
    subject: row && row.subject != null ? row.subject : defaultRender?.subject || '',
    htmlBody: row && row.htmlBody != null ? row.htmlBody : defaultRender?.html || '',
    textBody: row && row.textBody != null ? row.textBody : defaultRender?.text || '',
    default: {
      subject: defaultRender?.subject || '',
      htmlBody: defaultRender?.html || '',
      textBody: defaultRender?.text || '',
    },
    updatedAt: row ? row.updatedAt : null,
    updatedByUserId: row ? row.updatedByUserId : null,
  };
}

// Upsert from the admin editor.
async function saveForAdmin(key, payload, actorUserId) {
  if (!isKnownKey(key)) {
    throw { statusCode: 404, message: `Unknown template: ${key}` };
  }
  const trigger = TRIGGER_BY_KEY.get(key);
  const subject = String((payload && payload.subject) || '').trim();
  if (!subject) {
    throw { statusCode: 422, message: 'Subject is required.' };
  }
  const htmlBody = String((payload && payload.htmlBody) || '');
  const textBody = String((payload && payload.textBody) || '');
  const enabled =
    payload && payload.enabled === false ? false : true;
  const variables = (trigger.variables || []).join(', ');

  const [row] = await EmailTemplate.upsert({
    key,
    label: trigger.label,
    triggerPoint: trigger.trigger,
    variables,
    subject,
    htmlBody,
    textBody,
    enabled,
    updatedByUserId: actorUserId || null,
  });
  return row.get({ plain: true });
}

// Delete the custom row → renderer falls back to the hardcoded default.
async function resetForAdmin(key) {
  if (!isKnownKey(key)) {
    throw { statusCode: 404, message: `Unknown template: ${key}` };
  }
  await EmailTemplate.destroy({ where: { key } });
}

// Seed every known trigger with its placeholder-rendered default.
// Called by the seed script + idempotent — only inserts rows that
// don't already exist.
async function seedDefaults({ overwrite = false } = {}) {
  const created = [];
  const skipped = [];
  for (const trigger of TRIGGERS) {
    const existing = await EmailTemplate.findByPk(trigger.key);
    if (existing && !overwrite) {
      skipped.push(trigger.key);
      continue;
    }
    const rendered = buildPlaceholderRendering(trigger.key);
    if (!rendered) {
      skipped.push(trigger.key);
      continue;
    }
    await EmailTemplate.upsert({
      key: trigger.key,
      label: trigger.label,
      triggerPoint: trigger.trigger,
      variables: (trigger.variables || []).join(', '),
      subject: rendered.subject,
      htmlBody: rendered.html,
      textBody: rendered.text || '',
      enabled: true,
    });
    created.push(trigger.key);
  }
  return { created, skipped };
}

module.exports = {
  TRIGGERS,
  isKnownKey,
  interpolate,
  buildPlaceholderRendering,
  renderForSend,
  listForAdmin,
  getForAdmin,
  saveForAdmin,
  resetForAdmin,
  seedDefaults,
};
