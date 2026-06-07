// supportService — /contact form submissions land here. Persists a
// `support_tickets` row, fires an email to the configured support
// inbox, and exposes admin CRUD for triage under Pipeline → Support.

const { Op } = require('sequelize');
const { SupportTicket } = require('../models');
const adminSettings = require('./adminSettingsService');
const { sendEmail } = require('./emailService');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const VALID_STATUS = ['open', 'in_progress', 'resolved', 'closed'];

const norm = (s) => (s === null || s === undefined ? '' : String(s).trim());

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Create a support ticket from a /contact form submission. Sends an
 * email to the configured support inbox; email failure is non-fatal
 * so a temporary SMTP blip doesn't drop the ticket.
 */
async function createTicket({
  name,
  email,
  subject,
  message,
  userId,
  ipAddress,
  userAgent,
} = {}) {
  const safe = {
    name: norm(name),
    email: norm(email).toLowerCase(),
    subject: norm(subject),
    message: norm(message),
  };
  if (!safe.name) throw { statusCode: 400, message: 'Name is required.' };
  if (!safe.email) throw { statusCode: 400, message: 'Email is required.' };
  if (!EMAIL_RE.test(safe.email) || safe.email.length > 255) {
    throw { statusCode: 400, message: 'Email address looks invalid.' };
  }
  if (!safe.subject) throw { statusCode: 400, message: 'Subject is required.' };
  if (!safe.message) throw { statusCode: 400, message: 'Message is required.' };
  if (safe.name.length > 160) safe.name = safe.name.slice(0, 160);
  if (safe.subject.length > 255) safe.subject = safe.subject.slice(0, 255);

  const ticket = await SupportTicket.create({
    name: safe.name,
    email: safe.email,
    subject: safe.subject,
    message: safe.message,
    userId: userId || null,
    ipAddress: ipAddress || null,
    userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
  });

  // Notify the support inbox out-of-band. Wrapped in try/catch so a
  // mailer outage doesn't bubble up to the visitor — the row is the
  // source of truth, admin can re-send later via the admin panel.
  try {
    const to = await adminSettings.getString('supportEmail');
    if (to) {
      const safeName = escapeHtml(safe.name);
      const safeEmail = escapeHtml(safe.email);
      const safeSubject = escapeHtml(safe.subject);
      const safeMessage = escapeHtml(safe.message).replace(/\n/g, '<br>');
      await sendEmail({
        to,
        subject: `[Profirmo Support] ${safe.subject}`,
        text:
          `New /contact submission\n\n` +
          `Name:    ${safe.name}\n` +
          `Email:   ${safe.email}\n` +
          `Subject: ${safe.subject}\n` +
          `Ticket:  ${ticket.id}\n\n` +
          `--- Message ---\n${safe.message}\n`,
        html:
          `<h2>New /contact submission</h2>` +
          `<p><strong>Name:</strong> ${safeName}<br>` +
          `<strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a><br>` +
          `<strong>Subject:</strong> ${safeSubject}<br>` +
          `<strong>Ticket id:</strong> ${ticket.id}</p>` +
          `<h3>Message</h3>` +
          `<p>${safeMessage}</p>`,
      });
    }
  } catch (err) {
    console.warn(
      `[support] notification email failed for ticket ${ticket.id}: ${err.message}`
    );
  }

  return ticket.toJSON();
}

async function listTickets({
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
      { name: { [Op.like]: like } },
      { email: { [Op.like]: like } },
      { subject: { [Op.like]: like } },
      { message: { [Op.like]: like } },
    ];
  }
  const { rows, count } = await SupportTicket.findAndCountAll({
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

async function getTicket(id) {
  const row = await SupportTicket.findByPk(id);
  if (!row) throw { statusCode: 404, message: 'Ticket not found.' };
  return row.toJSON();
}

async function setStatus(id, status) {
  if (!VALID_STATUS.includes(status)) {
    throw {
      statusCode: 400,
      message: `status must be one of: ${VALID_STATUS.join(', ')}`,
    };
  }
  const row = await SupportTicket.findByPk(id);
  if (!row) throw { statusCode: 404, message: 'Ticket not found.' };
  await row.update({ status });
  return row.toJSON();
}

async function setAdminNote(id, adminNote) {
  const row = await SupportTicket.findByPk(id);
  if (!row) throw { statusCode: 404, message: 'Ticket not found.' };
  await row.update({ adminNote: norm(adminNote) || null });
  return row.toJSON();
}

async function removeTicket(id) {
  const row = await SupportTicket.findByPk(id);
  if (!row) throw { statusCode: 404, message: 'Ticket not found.' };
  await row.destroy();
  return { id };
}

module.exports = {
  createTicket,
  listTickets,
  getTicket,
  setStatus,
  setAdminNote,
  removeTicket,
  VALID_STATUS,
};
