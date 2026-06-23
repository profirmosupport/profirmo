// complianceObligationService — turn a ClientComplianceProfile +
// seeds/compliance-rules.json into ComplianceObligation rows for the
// upcoming N months.
//
// Design notes:
//   * The seeds JSON is reference data — its `dueDate`/`dueDates`
//     fields are *strings* meant for human reading. This service
//     contains the (small, explicit) decoder that turns those strings
//     into concrete YYYY-MM-DD dates per period. Adding a new rule to
//     the JSON without updating this decoder is a no-op.
//   * Idempotent: the unique index on (pro, client, rule, period)
//     means re-running generateForClient is safe — existing rows get
//     left alone unless an update path explicitly bumps them.
//   * Read-only generator: never auto-marks anything done. The pro
//     does that from the UI.

const path = require('path');
const fs = require('fs');
const { ComplianceObligation, ClientComplianceProfile } = require('../models');

let cachedRules = null;
function loadRules() {
  if (cachedRules) return cachedRules;
  const file = path.join(__dirname, '..', '..', 'seeds', 'compliance-rules.json');
  cachedRules = JSON.parse(fs.readFileSync(file, 'utf8'));
  return cachedRules;
}

// --- Date helpers -----------------------------------------------------

function pad2(n) {
  return String(n).padStart(2, '0');
}
function ymd(year, month1, day) {
  return `${year}-${pad2(month1)}-${pad2(day)}`;
}

// Indian FY runs April → March. Convenience helpers for period labels.
function fyLabel(year) {
  // Year here is the FY start year, so FY 2026-27 = year 2026.
  return `FY ${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
}
function ayLabel(fyStartYear) {
  return `AY ${fyStartYear + 1}-${String(fyStartYear + 2).slice(-2)}`;
}

// --- Rule applicability ----------------------------------------------

/**
 * Given a profile, return a list of canonical rule keys (matching the
 * `rules` object in compliance-rules.json) that should be generated.
 * Each entry is `{ section, key }` so the decoder below can look the
 * spec up.
 */
function applicableRules(profile) {
  if (!profile) return [];
  const out = [];

  const isGstReg = !!profile.gstin && profile.gstScheme && profile.gstScheme !== 'composition';
  const isGstComposition = !!profile.gstin && profile.gstScheme === 'composition';

  // --- Indirect tax ---
  if (isGstReg) {
    out.push({ section: 'indirectTax', key: 'gstr1' });
    out.push({ section: 'indirectTax', key: 'gstr3b' });
    out.push({ section: 'indirectTax', key: 'gstr9' });
    if (profile.gstr9cRequired) {
      out.push({ section: 'indirectTax', key: 'gstr9c' });
    }
  }
  if (isGstComposition) {
    out.push({ section: 'indirectTax', key: 'cmp08' });
  }

  // --- Direct tax ---
  // Advance tax + ITR apply to every entity type with income —
  // we lean on the pro to mark not_applicable when wrong.
  out.push({ section: 'directTax', key: 'advanceTax' });
  if (profile.tdsDeductor) {
    out.push({ section: 'directTax', key: 'tdsQuarterly' });
    out.push({ section: 'directTax', key: 'tdsPayment' });
  }
  if (profile.taxAuditRequired) {
    out.push({ section: 'directTax', key: 'itrAudit' });
    out.push({ section: 'directTax', key: 'taxAuditReport3CD' });
  } else {
    out.push({ section: 'directTax', key: 'itrIndividual' });
  }

  // --- ROC (companies + LLP-like) ---
  const isCompany = ['private_ltd', 'public_ltd'].includes(profile.entityType);
  if (isCompany) {
    out.push({ section: 'roc', key: 'aoc4' });
    out.push({ section: 'roc', key: 'mgt7' });
    out.push({ section: 'roc', key: 'dir3Kyc' });
    out.push({ section: 'roc', key: 'msmeReturn' });
  }

  return out;
}

// --- Period + date decoder -------------------------------------------

/**
 * For each rule, emit a list of upcoming periods + due dates within
 * the next N months. Hard-coded per rule because the spec strings in
 * the seeds JSON are written for humans — the decoder is the canonical
 * computational source.
 */
function periodsForRule(ruleKey, profile, now) {
  const today = now;
  const upcoming = []; // [{ periodLabel, dueDate }]

  const HORIZON_DAYS = 365;
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + HORIZON_DAYS);

  const fyStart = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  // FY end = March 31 of fyStart+1
  // AY end = July 31 of fyStart+1 (default) / Oct 31 if audit / Sep 30 for tax-audit report

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  if (ruleKey === 'gstr1') {
    if (profile.qrmpEligible) {
      // Quarterly: 13th of month after quarter-end. Quarters: Apr-Jun,
      // Jul-Sep, Oct-Dec, Jan-Mar.
      const quarters = [
        { qEnd: [fyStart, 5], dueMonth: 6 }, // June
        { qEnd: [fyStart, 8], dueMonth: 9 },
        { qEnd: [fyStart, 11], dueMonth: 12 },
        { qEnd: [fyStart + 1, 2], dueMonth: 3 },
      ];
      for (const q of quarters) {
        const dueYear = q.dueMonth < 4 ? fyStart + 1 : fyStart;
        const due = new Date(dueYear, q.dueMonth - 1, 13);
        if (due >= today && due <= horizon) {
          upcoming.push({
            periodLabel: `Q ending ${monthNames[q.qEnd[1]]} ${q.qEnd[0]} (GSTR-1)`,
            dueDate: ymd(due.getFullYear(), due.getMonth() + 1, due.getDate()),
          });
        }
      }
    } else {
      // Monthly: 11th of next month, for the next 12 calendar periods.
      for (let i = 0; i < 12; i += 1) {
        const target = new Date(today.getFullYear(), today.getMonth() + i, 11);
        if (target < today) continue;
        if (target > horizon) break;
        const coversMonth = new Date(target);
        coversMonth.setMonth(coversMonth.getMonth() - 1);
        upcoming.push({
          periodLabel: `${monthNames[coversMonth.getMonth()]} ${coversMonth.getFullYear()} (GSTR-1)`,
          dueDate: ymd(target.getFullYear(), target.getMonth() + 1, target.getDate()),
        });
      }
    }
  } else if (ruleKey === 'gstr3b') {
    // 20th of next month (treat category A/B uniformly for v1).
    for (let i = 0; i < 12; i += 1) {
      const target = new Date(today.getFullYear(), today.getMonth() + i, 20);
      if (target < today) continue;
      if (target > horizon) break;
      const coversMonth = new Date(target);
      coversMonth.setMonth(coversMonth.getMonth() - 1);
      upcoming.push({
        periodLabel: `${monthNames[coversMonth.getMonth()]} ${coversMonth.getFullYear()} (GSTR-3B)`,
        dueDate: ymd(target.getFullYear(), target.getMonth() + 1, target.getDate()),
      });
    }
  } else if (ruleKey === 'gstr9' || ruleKey === 'gstr9c') {
    // 31 Dec of next FY.
    const due = new Date(fyStart + 1, 11, 31);
    if (due >= today && due <= horizon) {
      upcoming.push({
        periodLabel: `${fyLabel(fyStart)} (${ruleKey.toUpperCase()})`,
        dueDate: ymd(due.getFullYear(), 12, 31),
      });
    }
  } else if (ruleKey === 'cmp08') {
    // 18th of month after quarter-end (composition).
    const quarters = [
      { qEnd: [fyStart, 5], dueMonth: 7 },
      { qEnd: [fyStart, 8], dueMonth: 10 },
      { qEnd: [fyStart, 11], dueMonth: 1, dueYear: fyStart + 1 },
      { qEnd: [fyStart + 1, 2], dueMonth: 4, dueYear: fyStart + 1 },
    ];
    for (const q of quarters) {
      const dueYear = q.dueYear ?? (q.dueMonth < 4 ? fyStart + 1 : fyStart);
      const due = new Date(dueYear, q.dueMonth - 1, 18);
      if (due >= today && due <= horizon) {
        upcoming.push({
          periodLabel: `Q ending ${monthNames[q.qEnd[1]]} ${q.qEnd[0]} (CMP-08)`,
          dueDate: ymd(due.getFullYear(), due.getMonth() + 1, due.getDate()),
        });
      }
    }
  } else if (ruleKey === 'advanceTax') {
    // 4 instalments: 15 Jun / 15 Sep / 15 Dec / 15 Mar.
    const instalments = [
      { month: 6, pct: 15 },
      { month: 9, pct: 45 },
      { month: 12, pct: 75 },
      { month: 3, pct: 100 },
    ];
    for (const inst of instalments) {
      const dueYear = inst.month < 4 ? fyStart + 1 : fyStart;
      const due = new Date(dueYear, inst.month - 1, 15);
      if (due >= today && due <= horizon) {
        upcoming.push({
          periodLabel: `${fyLabel(fyStart)} — ${inst.pct}% instalment`,
          dueDate: ymd(due.getFullYear(), inst.month, 15),
        });
      }
    }
  } else if (ruleKey === 'tdsQuarterly') {
    // Q1 Apr-Jun → 31 Jul; Q2 Jul-Sep → 31 Oct; Q3 Oct-Dec → 31 Jan; Q4 Jan-Mar → 31 May.
    const quarters = [
      { label: 'Q1 Apr-Jun', dueMonth: 7, dueYear: fyStart },
      { label: 'Q2 Jul-Sep', dueMonth: 10, dueYear: fyStart },
      { label: 'Q3 Oct-Dec', dueMonth: 1, dueYear: fyStart + 1 },
      { label: 'Q4 Jan-Mar', dueMonth: 5, dueYear: fyStart + 1 },
    ];
    for (const q of quarters) {
      const due = new Date(q.dueYear, q.dueMonth - 1, q.dueMonth === 7 ? 31 : q.dueMonth === 10 ? 31 : q.dueMonth === 1 ? 31 : 31);
      if (due >= today && due <= horizon) {
        upcoming.push({
          periodLabel: `${q.label} ${fyLabel(fyStart)} (TDS return)`,
          dueDate: ymd(due.getFullYear(), due.getMonth() + 1, due.getDate()),
        });
      }
    }
  } else if (ruleKey === 'tdsPayment') {
    // Monthly TDS deposit: 7th of next month (April deduction → 30 Apr
    // not 7 May per Indian rules, but we use 7th uniformly for v1).
    for (let i = 0; i < 12; i += 1) {
      const target = new Date(today.getFullYear(), today.getMonth() + i, 7);
      if (target < today) continue;
      if (target > horizon) break;
      const coversMonth = new Date(target);
      coversMonth.setMonth(coversMonth.getMonth() - 1);
      upcoming.push({
        periodLabel: `${monthNames[coversMonth.getMonth()]} ${coversMonth.getFullYear()} (TDS payment)`,
        dueDate: ymd(target.getFullYear(), target.getMonth() + 1, target.getDate()),
      });
    }
  } else if (ruleKey === 'itrIndividual') {
    const due = new Date(fyStart + 1, 6, 31); // 31 Jul of next FY.
    if (due >= today && due <= horizon) {
      upcoming.push({
        periodLabel: `${ayLabel(fyStart)} (ITR)`,
        dueDate: ymd(fyStart + 1, 7, 31),
      });
    }
  } else if (ruleKey === 'itrAudit') {
    const due = new Date(fyStart + 1, 9, 31); // 31 Oct of next FY.
    if (due >= today && due <= horizon) {
      upcoming.push({
        periodLabel: `${ayLabel(fyStart)} (ITR audit cases)`,
        dueDate: ymd(fyStart + 1, 10, 31),
      });
    }
  } else if (ruleKey === 'taxAuditReport3CD') {
    const due = new Date(fyStart + 1, 8, 30); // 30 Sep of next FY.
    if (due >= today && due <= horizon) {
      upcoming.push({
        periodLabel: `${ayLabel(fyStart)} (3CA/3CB-3CD)`,
        dueDate: ymd(fyStart + 1, 9, 30),
      });
    }
  } else if (ruleKey === 'aoc4') {
    // 30 days from AGM. AGM by default 30 Sep so AOC-4 ~30 Oct.
    const due = new Date(fyStart + 1, 9, 30);
    if (due >= today && due <= horizon) {
      upcoming.push({
        periodLabel: `${fyLabel(fyStart)} (AOC-4)`,
        dueDate: ymd(fyStart + 1, 10, 30),
      });
    }
  } else if (ruleKey === 'mgt7') {
    // 60 days from AGM ~ 29 Nov.
    const due = new Date(fyStart + 1, 10, 29);
    if (due >= today && due <= horizon) {
      upcoming.push({
        periodLabel: `${fyLabel(fyStart)} (MGT-7)`,
        dueDate: ymd(fyStart + 1, 11, 29),
      });
    }
  } else if (ruleKey === 'dir3Kyc') {
    const due = new Date(fyStart + 1, 8, 30); // 30 Sep.
    if (due >= today && due <= horizon) {
      upcoming.push({
        periodLabel: `${fyLabel(fyStart)} (DIR-3 KYC)`,
        dueDate: ymd(fyStart + 1, 9, 30),
      });
    }
  } else if (ruleKey === 'msmeReturn') {
    // H1: 31 Oct; H2: 30 Apr.
    const h1 = new Date(fyStart, 9, 31);
    const h2 = new Date(fyStart + 1, 3, 30);
    if (h1 >= today && h1 <= horizon) {
      upcoming.push({
        periodLabel: `H1 ${fyLabel(fyStart)} (MSME-1)`,
        dueDate: ymd(fyStart, 10, 31),
      });
    }
    if (h2 >= today && h2 <= horizon) {
      upcoming.push({
        periodLabel: `H2 ${fyLabel(fyStart)} (MSME-1)`,
        dueDate: ymd(fyStart + 1, 4, 30),
      });
    }
  }
  return upcoming;
}

// --- Public API ------------------------------------------------------

async function getProfile(professionalId, clientUserId) {
  return ClientComplianceProfile.findOne({
    where: { professionalId, clientUserId },
    raw: true,
  });
}

async function upsertProfile(professionalId, clientUserId, payload) {
  const existing = await ClientComplianceProfile.findOne({
    where: { professionalId, clientUserId },
  });
  // Sanitize inputs — keep only known columns.
  const patch = {};
  if (payload.entityType !== undefined) {
    patch.entityType = ClientComplianceProfile.ENTITY_TYPES.includes(payload.entityType)
      ? payload.entityType
      : null;
  }
  for (const f of ['pan', 'gstin', 'cin', 'notes']) {
    if (payload[f] !== undefined) patch[f] = payload[f] || null;
  }
  if (payload.gstScheme !== undefined) {
    patch.gstScheme = ['regular', 'composition', 'casual', 'isd'].includes(payload.gstScheme)
      ? payload.gstScheme
      : null;
  }
  for (const f of ['qrmpEligible', 'tdsDeductor', 'taxAuditRequired', 'gstr9cRequired']) {
    if (payload[f] !== undefined) patch[f] = !!payload[f];
  }

  if (existing) {
    await existing.update(patch);
    return existing.get({ plain: true });
  }
  const row = await ClientComplianceProfile.create({
    professionalId,
    clientUserId,
    ...patch,
  });
  return row.get({ plain: true });
}

/**
 * Walk the profile + rule set, compute upcoming due dates, and
 * upsert ComplianceObligation rows. Returns the created/found rows.
 */
async function generateForClient(professionalId, clientUserId) {
  const profile = await getProfile(professionalId, clientUserId);
  if (!profile) {
    throw {
      statusCode: 422,
      message: 'No compliance profile exists for this client yet.',
    };
  }
  const rules = loadRules();
  const applicable = applicableRules(profile);
  const now = new Date();

  let created = 0;
  let existingCount = 0;
  for (const { section, key } of applicable) {
    const spec = rules[section] && rules[section][key];
    if (!spec) continue;
    const periods = periodsForRule(key, profile, now);
    for (const p of periods) {
      // Sequelize findOrCreate resolves to [instance, wasCreated:boolean].
      const [, wasCreated] = await ComplianceObligation.findOrCreate({
        where: {
          professionalId,
          clientUserId,
          ruleKey: key,
          periodLabel: p.periodLabel,
        },
        defaults: { dueDate: p.dueDate },
      });
      if (wasCreated) created += 1;
      else existingCount += 1;
    }
  }
  return { created, existing: existingCount };
}

async function listForProfessional(professionalId, { from, to, status } = {}) {
  const { Op } = require('sequelize');
  const where = { professionalId };
  if (from || to) {
    where.dueDate = {};
    if (from) where.dueDate[Op.gte] = from;
    if (to) where.dueDate[Op.lte] = to;
  }
  if (status) where.status = status;
  return ComplianceObligation.findAll({
    where,
    order: [['dueDate', 'ASC']],
    raw: true,
  });
}

async function updateObligation(professionalId, id, payload) {
  const row = await ComplianceObligation.findOne({
    where: { id, professionalId },
  });
  if (!row) throw { statusCode: 404, message: 'Obligation not found' };
  const patch = {};
  if (payload.status !== undefined) {
    if (!ComplianceObligation.STATUSES.includes(payload.status)) {
      throw {
        statusCode: 422,
        message: `status must be one of: ${ComplianceObligation.STATUSES.join(', ')}`,
      };
    }
    patch.status = payload.status;
    if (payload.status === 'done' && row.status !== 'done') {
      patch.completedAt = new Date();
    } else if (payload.status !== 'done' && row.status === 'done') {
      patch.completedAt = null;
      patch.completedByUserId = null;
    }
  }
  if (payload.notes !== undefined) patch.notes = payload.notes || null;
  if (payload.attachmentStoragePath !== undefined) {
    patch.attachmentStoragePath = payload.attachmentStoragePath || null;
  }
  if (payload.attachmentFileName !== undefined) {
    patch.attachmentFileName = payload.attachmentFileName || null;
  }
  await row.update(patch);
  return row.get({ plain: true });
}

/**
 * Client self-read: get the most-recently-updated profile across any
 * professional this user is linked with. Returns null when no pro has
 * set up a profile yet (the UI then offers a "fill in your details"
 * empty state).
 */
async function getMyProfile(clientUserId) {
  return ClientComplianceProfile.findOne({
    where: { clientUserId },
    order: [['updatedAt', 'DESC']],
    raw: true,
  });
}

/**
 * Client self-write: propagate the client's profile edit to EVERY
 * row scoped to them across all their pros. The first time a client
 * fills in details no row may exist yet — in that case we silently
 * accept the update but it has no effect until a pro saves a profile
 * (the pro-side modal seeds the row from this snapshot).
 */
async function upsertMyProfile(clientUserId, payload) {
  const rows = await ClientComplianceProfile.findAll({
    where: { clientUserId },
  });
  const patch = {};
  if (payload.entityType !== undefined) {
    patch.entityType = ClientComplianceProfile.ENTITY_TYPES.includes(payload.entityType)
      ? payload.entityType
      : null;
  }
  for (const f of ['pan', 'gstin', 'cin', 'notes']) {
    if (payload[f] !== undefined) patch[f] = payload[f] || null;
  }
  if (payload.gstScheme !== undefined) {
    patch.gstScheme = ['regular', 'composition', 'casual', 'isd'].includes(payload.gstScheme)
      ? payload.gstScheme
      : null;
  }
  for (const f of ['qrmpEligible', 'tdsDeductor', 'taxAuditRequired', 'gstr9cRequired']) {
    if (payload[f] !== undefined) patch[f] = !!payload[f];
  }
  for (const r of rows) {
    await r.update(patch);
  }
  return { applied: rows.length, patch };
}

/**
 * Client self-read of obligations across all their pros, filtered to
 * only those that match the client's CURRENT entity type. If the
 * client's profile entityType changed (e.g. from private_ltd back to
 * individual), legacy rows from the old applicable-rule set are
 * suppressed so the client doesn't see filings that no longer apply.
 */
async function listForClient(clientUserId, { from, to, status } = {}) {
  const { Op } = require('sequelize');
  const profile = await getMyProfile(clientUserId);
  const where = { clientUserId };
  if (from || to) {
    where.dueDate = {};
    if (from) where.dueDate[Op.gte] = from;
    if (to) where.dueDate[Op.lte] = to;
  }
  if (status) where.status = status;
  const rows = await ComplianceObligation.findAll({
    where,
    order: [['dueDate', 'ASC']],
    raw: true,
  });

  // If we know the entity type, restrict to applicable rule keys.
  if (profile && profile.entityType) {
    const allowedKeys = new Set(
      applicableRules(profile).map((r) => r.key)
    );
    return rows.filter((r) => allowedKeys.has(r.ruleKey));
  }
  return rows;
}

module.exports = {
  getProfile,
  upsertProfile,
  generateForClient,
  listForProfessional,
  updateObligation,
  applicableRules, // exported for testing / preview
  getMyProfile,
  upsertMyProfile,
  listForClient,
};
