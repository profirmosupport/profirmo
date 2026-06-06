// newsletterService — CRUD over the newsletter_subscribers table.
// Public side: subscribe (with email) + complete (additional info).
// Admin side: list + delete + toggle status.

const { Op } = require('sequelize');
const { NewsletterSubscriber } = require('../models');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()0-9\s-]{6,20}$/;

const norm = (s) => (s === null || s === undefined ? '' : String(s).trim());
const normEmail = (s) => norm(s).toLowerCase();

/**
 * Create or claim a subscriber row from the footer email box. Returns
 * `{ subscriber, isNew }` so the caller can decide whether to launch
 * the "tell us more" follow-up modal.
 *
 * Idempotent: re-submitting the same email returns the existing row
 * with `isNew=false` (still re-opens the modal so the visitor can
 * fill in / update their details).
 */
async function subscribe({ email, source, ipAddress, userAgent } = {}) {
  const e = normEmail(email);
  if (!e) throw { statusCode: 400, message: 'Email is required.' };
  if (!EMAIL_RE.test(e) || e.length > 255) {
    throw { statusCode: 400, message: 'That email address looks invalid.' };
  }
  const existing = await NewsletterSubscriber.findOne({ where: { email: e } });
  if (existing) {
    // Resurrect unsubscribed rows so admin can see they re-engaged.
    if (existing.status !== 'active') {
      await existing.update({ status: 'active' });
    }
    return { subscriber: existing.toJSON(), isNew: false };
  }
  const row = await NewsletterSubscriber.create({
    email: e,
    source: source || 'footer',
    ipAddress: ipAddress || null,
    userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
  });
  return { subscriber: row.toJSON(), isNew: true };
}

/**
 * Fill in the optional fields collected by the post-subscribe modal.
 * Identified by email (the only thing the public client has on hand)
 * so anyone can re-fill their own profile without an auth token. We
 * NEVER let the caller change someone else's email — the field is
 * locked to the lookup key.
 */
async function completeProfile({ email, fullName, phone, city, interests } = {}) {
  const e = normEmail(email);
  if (!e) throw { statusCode: 400, message: 'Email is required.' };
  const row = await NewsletterSubscriber.findOne({ where: { email: e } });
  if (!row) {
    throw {
      statusCode: 404,
      message: 'No subscription found for this email. Please subscribe first.',
    };
  }
  const patch = {};
  const name = norm(fullName);
  if (name) {
    if (name.length > 160) {
      throw { statusCode: 400, message: 'Full name is too long (max 160 chars).' };
    }
    patch.fullName = name;
  }
  const ph = norm(phone);
  if (ph) {
    if (!PHONE_RE.test(ph)) {
      throw { statusCode: 400, message: 'That phone number looks invalid.' };
    }
    patch.phone = ph;
  }
  const c = norm(city);
  if (c) {
    if (c.length > 120) {
      throw { statusCode: 400, message: 'City name is too long.' };
    }
    patch.city = c;
  }
  const intr = norm(interests);
  if (intr) {
    patch.interests = intr.slice(0, 255);
  }
  if (Object.keys(patch).length === 0) {
    return row.toJSON();
  }
  await row.update(patch);
  return row.toJSON();
}

/** List subscribers, optionally filtered + paginated. */
async function listSubscribers({
  page = 1,
  limit = 50,
  search = '',
  status,
} = {}) {
  const safePage = Number(page) > 0 ? Math.floor(Number(page)) : 1;
  const safeLimit =
    Number(limit) > 0 ? Math.min(Math.floor(Number(limit)), 200) : 50;

  const where = {};
  if (status) where.status = status;
  const term = norm(search);
  if (term) {
    const like = `%${term}%`;
    where[Op.or] = [
      { email: { [Op.like]: like } },
      { fullName: { [Op.like]: like } },
      { phone: { [Op.like]: like } },
      { city: { [Op.like]: like } },
      { interests: { [Op.like]: like } },
    ];
  }

  const { rows, count } = await NewsletterSubscriber.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  });
  return {
    rows: rows.map((r) => r.toJSON()),
    page: safePage,
    limit: safeLimit,
    total: count,
    totalPages: Math.max(1, Math.ceil(count / safeLimit)),
  };
}

async function setStatus(id, status) {
  if (!['active', 'unsubscribed'].includes(status)) {
    throw { statusCode: 400, message: 'status must be active or unsubscribed.' };
  }
  const row = await NewsletterSubscriber.findByPk(id);
  if (!row) throw { statusCode: 404, message: 'Subscriber not found.' };
  await row.update({ status });
  return row.toJSON();
}

async function removeSubscriber(id) {
  const row = await NewsletterSubscriber.findByPk(id);
  if (!row) throw { statusCode: 404, message: 'Subscriber not found.' };
  await row.destroy();
  return { id };
}

module.exports = {
  subscribe,
  completeProfile,
  listSubscribers,
  setStatus,
  removeSubscriber,
};
