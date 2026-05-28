// leadService — CRUD + activity feed for Lead + Opportunity.
//
// Public surface:
//   capturePublic({ fullName, email, phone, source })
//     - Normalises input, dedups by email/phone, creates the Lead (or
//       updates the existing one) and writes an activity entry. Returns
//       { lead, deduped: bool }.
//
// Admin surface:
//   listLeads / getLead / updateLead / deleteLead / addNote /
//   listActivities / convertToOpportunity
//   listOpportunities / getOpportunity / updateOpportunity /
//   deleteOpportunity / convertToClient
//
// Activities are persisted by `recordActivity` so each list / detail view
// gets a chronological timeline.

const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  Lead,
  Opportunity,
  LeadActivity,
  User,
  LawFirm,
} = require('../models');
const { hashPassword } = require('../utils/password');
const authService = require('./authService');

const LEAD_STATUSES = [
  'New',
  'Contacted',
  'Qualified',
  'Opportunity',
  'Converted',
];
const OPPORTUNITY_STATUSES = [
  'Open',
  'In Discussion',
  'Won',
  'Lost',
  'Converted',
];

function httpError(statusCode, message, extra = {}) {
  return { statusCode, message, ...extra };
}

const norm = (s) => String(s || '').trim();
const lower = (s) => norm(s).toLowerCase();

function validateLeadInput({ fullName, email, phone }) {
  const errors = {};
  if (!norm(fullName)) errors.fullName = 'Full name is required.';
  const e = lower(email);
  if (!e) errors.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    errors.email = 'Enter a valid email address.';
  }
  const p = norm(phone).replace(/[^\d+]/g, '');
  if (!p) errors.phone = 'Phone is required.';
  else if (p.replace(/\D/g, '').length < 7) {
    errors.phone = 'Enter a valid phone number.';
  }
  if (Object.keys(errors).length > 0) {
    throw httpError(422, 'Validation failed', { errors });
  }
  return { fullName: norm(fullName), email: e, phone: p };
}

async function userDisplayName(userId) {
  if (!userId) return '';
  const u = await User.findByPk(userId, { raw: true });
  if (!u) return '';
  return (
    u.fullName ||
    [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
    u.name ||
    ''
  );
}

async function recordActivity({
  entityType,
  entityId,
  action,
  actorUserId = null,
  fromValue = null,
  toValue = null,
  note = null,
}) {
  const actorName = actorUserId ? await userDisplayName(actorUserId) : '';
  return LeadActivity.create({
    entityType,
    entityId,
    action,
    actorUserId,
    actorName,
    fromValue: fromValue === null || fromValue === undefined ? null : String(fromValue),
    toValue: toValue === null || toValue === undefined ? null : String(toValue),
    note: note || null,
  });
}

// --- Public capture --------------------------------------------------------

async function capturePublic(payload) {
  const clean = validateLeadInput(payload);
  const source = norm(payload.source) || 'Homepage AI CTA';
  const message = norm(payload.message) || null;
  const firmId = norm(payload.firmId) || null;

  // Firm-contact leads bypass dedup so every inquiry shows up on the firm's
  // dashboard, even if the visitor has previously contacted somebody else.
  // The legacy homepage / advanced-search lead capture still dedups so we
  // don't pile up duplicate marketing rows for the same email.
  if (!firmId) {
    const existing = await Lead.findOne({
      where: {
        [Op.or]: [
          { email: clean.email },
          { phone: clean.phone },
        ],
      },
      order: [['createdAt', 'DESC']],
    });
    if (existing) {
      const patch = {};
      if (existing.fullName !== clean.fullName) patch.fullName = clean.fullName;
      if (existing.email !== clean.email) patch.email = clean.email;
      if (existing.phone !== clean.phone) patch.phone = clean.phone;
      if (Object.keys(patch).length > 0) {
        await existing.update(patch);
      }
      await recordActivity({
        entityType: 'lead',
        entityId: existing.id,
        action: 'lead.resubmitted',
        toValue: source,
        note: `Submission re-captured from ${source}.`,
      });
      return { lead: existing.get({ plain: true }), deduped: true };
    }
  }

  const lead = await Lead.create({
    fullName: clean.fullName,
    email: clean.email,
    phone: clean.phone,
    message,
    firmId,
    source,
    status: 'New',
  });
  await recordActivity({
    entityType: 'lead',
    entityId: lead.id,
    action: 'lead.created',
    toValue: source,
    note: `Lead captured from ${source}.`,
  });
  return { lead: lead.get({ plain: true }), deduped: false };
}

async function getLeadById(id) {
  const lead = await Lead.findByPk(id);
  return lead ? lead.get({ plain: true }) : null;
}

// --- Admin: leads ---------------------------------------------------------

async function listLeads({
  page = 1,
  limit = 20,
  search,
  status,
  source,
  assignedTo,
  dateFrom,
  dateTo,
} = {}) {
  const where = {};
  if (search && norm(search)) {
    const q = `%${norm(search)}%`;
    where[Op.or] = [
      { fullName: { [Op.like]: q } },
      { email: { [Op.like]: q } },
      { phone: { [Op.like]: q } },
    ];
  }
  if (status && norm(status)) where.status = status;
  if (source && norm(source)) where.source = source;
  if (assignedTo && norm(assignedTo)) where.assignedToUserId = assignedTo;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      where.createdAt[Op.lte] = end;
    }
  }

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const offset = (safePage - 1) * safeLimit;

  const { rows, count } = await Lead.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: safeLimit,
    offset,
    raw: true,
  });
  // Decorate each row with the firm's display name so the admin panel can
  // surface "Acme Legal" instead of an opaque `lawfirm-…` id. Batched into
  // a single query keyed by firmId so we don't N+1 on big lists.
  const firmIds = [...new Set(rows.map((r) => r.firmId).filter(Boolean))];
  if (firmIds.length > 0) {
    const firms = await LawFirm.findAll({
      where: { id: { [Op.in]: firmIds } },
      attributes: ['id', 'firmName'],
      raw: true,
    });
    const byId = new Map(firms.map((f) => [f.id, f.firmName]));
    rows.forEach((r) => {
      r.firmName = r.firmId ? byId.get(r.firmId) || null : null;
    });
  } else {
    rows.forEach((r) => {
      r.firmName = null;
    });
  }
  return {
    rows,
    page: safePage,
    limit: safeLimit,
    total: count,
  };
}

/**
 * List leads addressed to a specific firm (used by the firm dashboard's
 * leads pipeline). No pagination — firms see all of their own inquiries.
 */
async function listLeadsByFirm(firmId) {
  if (!firmId) return [];
  const rows = await Lead.findAll({
    where: { firmId },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  return rows;
}

async function adminCreateLead({ fullName, email, phone, source, status, notes, assignedToUserId }, actingUserId) {
  const clean = validateLeadInput({ fullName, email, phone });
  const lead = await Lead.create({
    fullName: clean.fullName,
    email: clean.email,
    phone: clean.phone,
    source: norm(source) || 'Manual',
    status: norm(status) && LEAD_STATUSES.includes(status) ? status : 'New',
    notes: notes || null,
    assignedToUserId: assignedToUserId || null,
  });
  await recordActivity({
    entityType: 'lead',
    entityId: lead.id,
    action: 'lead.created',
    actorUserId: actingUserId,
    toValue: lead.source,
    note: 'Lead created from admin panel.',
  });
  return lead.get({ plain: true });
}

async function updateLead(id, changes, actingUserId) {
  const lead = await Lead.findByPk(id);
  if (!lead) throw httpError(404, 'Lead not found');
  const patch = {};
  if (changes.fullName !== undefined && norm(changes.fullName)) {
    patch.fullName = norm(changes.fullName);
  }
  if (changes.email !== undefined && norm(changes.email)) {
    patch.email = lower(changes.email);
  }
  if (changes.phone !== undefined && norm(changes.phone)) {
    patch.phone = norm(changes.phone);
  }
  if (changes.source !== undefined) patch.source = norm(changes.source) || lead.source;
  if (changes.notes !== undefined) patch.notes = changes.notes;
  if (changes.assignedToUserId !== undefined) {
    patch.assignedToUserId = changes.assignedToUserId || null;
  }

  let statusChanged = null;
  if (changes.status !== undefined && changes.status !== lead.status) {
    if (!LEAD_STATUSES.includes(changes.status)) {
      throw httpError(422, `Unknown lead status: ${changes.status}`);
    }
    patch.status = changes.status;
    statusChanged = { from: lead.status, to: changes.status };
  }

  let assignmentChanged = null;
  if (
    changes.assignedToUserId !== undefined &&
    (changes.assignedToUserId || null) !== (lead.assignedToUserId || null)
  ) {
    assignmentChanged = {
      from: lead.assignedToUserId,
      to: changes.assignedToUserId || null,
    };
  }

  await lead.update(patch);

  if (statusChanged) {
    await recordActivity({
      entityType: 'lead',
      entityId: lead.id,
      action: 'lead.status_changed',
      actorUserId: actingUserId,
      fromValue: statusChanged.from,
      toValue: statusChanged.to,
    });
  }
  if (assignmentChanged) {
    const assigneeName = assignmentChanged.to
      ? await userDisplayName(assignmentChanged.to)
      : '(unassigned)';
    await recordActivity({
      entityType: 'lead',
      entityId: lead.id,
      action: 'lead.assigned',
      actorUserId: actingUserId,
      fromValue: assignmentChanged.from,
      toValue: assignmentChanged.to,
      note: `Assigned to ${assigneeName}.`,
    });
  }
  if (statusChanged === null && assignmentChanged === null) {
    await recordActivity({
      entityType: 'lead',
      entityId: lead.id,
      action: 'lead.edited',
      actorUserId: actingUserId,
      note: `Fields edited: ${Object.keys(patch).join(', ') || 'none'}.`,
    });
  }

  return lead.get({ plain: true });
}

async function deleteLead(id, actingUserId) {
  const lead = await Lead.findByPk(id);
  if (!lead) throw httpError(404, 'Lead not found');
  await lead.destroy();
  // Activity rows are intentionally kept for the audit trail; they no longer
  // resolve to a parent entity but remain queryable by entityId.
  await recordActivity({
    entityType: 'lead',
    entityId: id,
    action: 'lead.deleted',
    actorUserId: actingUserId,
  });
  return { id };
}

async function addNote(entityType, entityId, message, actingUserId) {
  const txt = norm(message);
  if (!txt) throw httpError(422, 'Note text is required.');
  const exists =
    entityType === 'lead'
      ? await Lead.findByPk(entityId)
      : await Opportunity.findByPk(entityId);
  if (!exists) {
    throw httpError(404, `${entityType} not found`);
  }
  return recordActivity({
    entityType,
    entityId,
    action: `${entityType}.note_added`,
    actorUserId: actingUserId,
    note: txt,
  });
}

async function listActivities(entityType, entityId) {
  return LeadActivity.findAll({
    where: { entityType, entityId },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
}

// --- Convert lead -> opportunity ------------------------------------------

async function convertLeadToOpportunity(leadId, actingUserId) {
  const lead = await Lead.findByPk(leadId);
  if (!lead) throw httpError(404, 'Lead not found');
  if (lead.opportunityId) {
    // Already converted — return the existing opportunity.
    const existing = await Opportunity.findByPk(lead.opportunityId);
    if (existing) return existing.get({ plain: true });
  }
  const opp = await Opportunity.create({
    leadId: lead.id,
    fullName: lead.fullName,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    status: 'Open',
    notes: lead.notes,
    assignedToUserId: lead.assignedToUserId,
  });
  await lead.update({
    status: 'Opportunity',
    opportunityId: opp.id,
  });
  await recordActivity({
    entityType: 'lead',
    entityId: lead.id,
    action: 'lead.converted_to_opportunity',
    actorUserId: actingUserId,
    toValue: opp.id,
    note: 'Lead promoted to opportunity.',
  });
  await recordActivity({
    entityType: 'opportunity',
    entityId: opp.id,
    action: 'opportunity.created',
    actorUserId: actingUserId,
    fromValue: lead.id,
    note: `Created from lead ${lead.id}.`,
  });
  return opp.get({ plain: true });
}

// --- Admin: opportunities -------------------------------------------------

async function listOpportunities({
  page = 1,
  limit = 20,
  search,
  status,
  assignedTo,
  dateFrom,
  dateTo,
} = {}) {
  const where = {};
  if (search && norm(search)) {
    const q = `%${norm(search)}%`;
    where[Op.or] = [
      { fullName: { [Op.like]: q } },
      { email: { [Op.like]: q } },
      { phone: { [Op.like]: q } },
    ];
  }
  if (status && norm(status)) where.status = status;
  if (assignedTo && norm(assignedTo)) where.assignedToUserId = assignedTo;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      where.createdAt[Op.lte] = end;
    }
  }

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const offset = (safePage - 1) * safeLimit;

  const { rows, count } = await Opportunity.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: safeLimit,
    offset,
    raw: true,
  });
  return {
    rows,
    page: safePage,
    limit: safeLimit,
    total: count,
  };
}

async function getOpportunityById(id) {
  const o = await Opportunity.findByPk(id);
  return o ? o.get({ plain: true }) : null;
}

async function updateOpportunity(id, changes, actingUserId) {
  const opp = await Opportunity.findByPk(id);
  if (!opp) throw httpError(404, 'Opportunity not found');
  const patch = {};
  if (changes.notes !== undefined) patch.notes = changes.notes;
  if (changes.assignedToUserId !== undefined) {
    patch.assignedToUserId = changes.assignedToUserId || null;
  }

  let statusChanged = null;
  if (changes.status !== undefined && changes.status !== opp.status) {
    if (!OPPORTUNITY_STATUSES.includes(changes.status)) {
      throw httpError(422, `Unknown opportunity status: ${changes.status}`);
    }
    patch.status = changes.status;
    statusChanged = { from: opp.status, to: changes.status };
  }
  await opp.update(patch);

  if (statusChanged) {
    await recordActivity({
      entityType: 'opportunity',
      entityId: opp.id,
      action: 'opportunity.status_changed',
      actorUserId: actingUserId,
      fromValue: statusChanged.from,
      toValue: statusChanged.to,
    });
  } else {
    await recordActivity({
      entityType: 'opportunity',
      entityId: opp.id,
      action: 'opportunity.edited',
      actorUserId: actingUserId,
      note: `Fields edited: ${Object.keys(patch).join(', ') || 'none'}.`,
    });
  }
  return opp.get({ plain: true });
}

async function deleteOpportunity(id, actingUserId) {
  const opp = await Opportunity.findByPk(id);
  if (!opp) throw httpError(404, 'Opportunity not found');
  await opp.destroy();
  await recordActivity({
    entityType: 'opportunity',
    entityId: id,
    action: 'opportunity.deleted',
    actorUserId: actingUserId,
  });
  return { id };
}

// --- Convert opportunity -> client ----------------------------------------

async function convertOpportunityToClient(id, actingUserId) {
  const opp = await Opportunity.findByPk(id);
  if (!opp) throw httpError(404, 'Opportunity not found');
  if (opp.clientId) {
    return {
      opportunity: opp.get({ plain: true }),
      clientUserId: opp.clientId,
      alreadyConverted: true,
    };
  }
  const email = lower(opp.email);
  let user = await User.findOne({ where: { email } });
  if (!user) {
    const tempPassword = crypto.randomBytes(18).toString('base64url');
    user = await User.create({
      email,
      password: await hashPassword(tempPassword),
      role: 'client',
      name: opp.fullName,
      fullName: opp.fullName,
      mobileNumber: opp.phone,
      status: 'active',
      accountVerified: true,
      emailVerified: true,
      memberSince: new Date(),
    });
  }
  await opp.update({
    status: 'Converted',
    clientId: user.id,
    convertedAt: new Date(),
  });
  // Mark the originating lead as converted too.
  const lead = await Lead.findByPk(opp.leadId);
  if (lead) {
    await lead.update({
      status: 'Converted',
      clientId: user.id,
      convertedAt: new Date(),
    });
    await recordActivity({
      entityType: 'lead',
      entityId: lead.id,
      action: 'lead.converted_to_client',
      actorUserId: actingUserId,
      toValue: user.id,
    });
  }
  await recordActivity({
    entityType: 'opportunity',
    entityId: opp.id,
    action: 'opportunity.converted_to_client',
    actorUserId: actingUserId,
    toValue: user.id,
    note: `Client account created: ${user.email}.`,
  });
  // Fire-and-forget: send the same OTP-based forgot-password email used in
  // the regular reset flow so the new client can set their own password.
  // Failure here must not block the conversion.
  try {
    await authService.forgotPassword(user.email);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[leadService] convertOpportunityToClient: password reset send failed: ${err.message}`
    );
  }
  return {
    opportunity: opp.get({ plain: true }),
    clientUserId: user.id,
    alreadyConverted: false,
  };
}

module.exports = {
  LEAD_STATUSES,
  OPPORTUNITY_STATUSES,
  capturePublic,
  getLeadById,
  listLeads,
  listLeadsByFirm,
  adminCreateLead,
  updateLead,
  deleteLead,
  addNote,
  listActivities,
  convertLeadToOpportunity,
  listOpportunities,
  getOpportunityById,
  updateOpportunity,
  deleteOpportunity,
  convertOpportunityToClient,
};
