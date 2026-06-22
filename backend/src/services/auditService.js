// auditService — write side of the append-only audit log. Every
// mutation in the system funnels through `record` (or the convenience
// helpers below) so the resulting `audit_events` row captures actor,
// IP, before/after JSON.
//
// Read side: `listForEntity(entityType, entityId)` returns the trail
// for a single record (case/booking/etc.), newest-first.
//
// Failure model: writes are fire-and-forget *for the actor*. If the
// audit insert fails, we log to stderr but DO NOT throw, because
// blocking a real business action on the audit table being temporarily
// broken would be worse than a gap in the trail. That gap shows up
// as a discontinuity in the trail (mtime on the entity vs missing
// event row) which itself is detectable.

const { AuditEvent } = require('../models');

// Whitelist of keys that should never appear in audit payloads — even
// in a before/after diff — because they're high-secret. We just drop
// them silently; nobody auditing a case needs to see a JWT or password
// hash.
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'jwt',
  'token',
  'refreshToken',
  'otp',
  'secret',
  'awsSecretAccessKey',
  'razorpayKeySecret',
]);

function redact(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const out = {};
  for (const k of Object.keys(obj)) {
    if (SENSITIVE_KEYS.has(k)) continue;
    out[k] = redact(obj[k]);
  }
  return out;
}

/**
 * Compute a minimal diff between two plain objects — only keys whose
 * stringified value differs. Callers can pass whole-row snapshots and
 * the result still stays small.
 */
function diff(before, after) {
  const b = before || {};
  const a = after || {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const beforeDiff = {};
  const afterDiff = {};
  for (const k of keys) {
    if (SENSITIVE_KEYS.has(k)) continue;
    const bv = b[k];
    const av = a[k];
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      beforeDiff[k] = bv === undefined ? null : bv;
      afterDiff[k] = av === undefined ? null : av;
    }
  }
  return { before: beforeDiff, after: afterDiff };
}

/**
 * Extract actor + IP + user-agent from the Express request. Safe to
 * call with `null` (background jobs / migrations) — the audit row will
 * just have those columns null.
 */
function extractContext(req) {
  if (!req) return { actorUserId: null, actorRole: null, ip: null, userAgent: null };
  const user = req.user || {};
  return {
    actorUserId: user.id || null,
    actorRole: user.role || null,
    ip:
      (req.headers && (req.headers['x-forwarded-for'] || '').split(',')[0].trim()) ||
      req.ip ||
      null,
    userAgent: (req.headers && req.headers['user-agent']) || null,
  };
}

/**
 * Low-level record — takes everything explicitly. Most callers want
 * one of the convenience wrappers below.
 */
async function record({
  req,
  actorUserId,
  actorRole,
  ip,
  userAgent,
  entityType,
  entityId,
  action,
  before,
  after,
  summary,
}) {
  try {
    if (!entityType || !entityId || !action) return null;
    const ctx = req ? extractContext(req) : {};
    return await AuditEvent.create({
      actorUserId: actorUserId ?? ctx.actorUserId ?? null,
      actorRole: actorRole ?? ctx.actorRole ?? null,
      ip: ip ?? ctx.ip ?? null,
      userAgent: userAgent ?? ctx.userAgent ?? null,
      entityType: String(entityType).slice(0, 40),
      entityId: String(entityId).slice(0, 64),
      action,
      before: before ? redact(before) : null,
      after: after ? redact(after) : null,
      summary: summary ? String(summary).slice(0, 255) : null,
    });
  } catch (err) {
    // Never throw out of the audit path — log + continue. See the
    // failure-model note at the top of this file.
    // eslint-disable-next-line no-console
    console.error('[audit] failed to record event:', err.message || err);
    return null;
  }
}

const recordCreate = (opts) =>
  record({ ...opts, action: 'create', before: null });

const recordDelete = (opts) =>
  record({ ...opts, action: 'delete', after: null });

const recordUpdate = (opts) => {
  const { before, after } = opts;
  const trimmed = diff(before, after);
  return record({ ...opts, action: 'update', before: trimmed.before, after: trimmed.after });
};

async function listForEntity(entityType, entityId, { limit = 200 } = {}) {
  return AuditEvent.findAll({
    where: { entityType, entityId },
    order: [['createdAt', 'DESC']],
    limit,
    raw: true,
  });
}

module.exports = {
  record,
  recordCreate,
  recordUpdate,
  recordDelete,
  listForEntity,
  diff,
  extractContext,
};
