// Email service for the Profirmo backend (Phase 6).
//
// Two delivery modes, selected by env.emailTransport:
//   'dev'  - no network: every email is rendered to an HTML file under
//            backend/sent-emails/ and a one-line summary is logged. This is
//            the default so a fresh checkout works with zero SMTP config.
//   'smtp' - a real nodemailer SMTP transport built from env.smtp.
//
// sendEmail() is awaited by the queue's `email` job handler.

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const env = require('../config/env');

// Directory where 'dev'-transport emails are written. Created at module load
// so the very first send never fails on a missing directory.
const SENT_DIR = path.join(__dirname, '../../sent-emails');
fs.mkdirSync(SENT_DIR, { recursive: true });

// Lazily-built SMTP transport (only when env.emailTransport === 'smtp').
let smtpTransport = null;
const getSmtpTransport = () => {
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth:
        env.smtp.user || env.smtp.pass
          ? { user: env.smtp.user, pass: env.smtp.pass }
          : undefined,
    });
  }
  return smtpTransport;
};

// Build a filesystem-safe slug from a recipient address.
const sanitizeRecipient = (to) =>
  String(to || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .slice(0, 80);

/**
 * Send an email. In 'dev' mode the message is written to disk; in 'smtp'
 * mode it is delivered through a real SMTP transport.
 *
 * @param {object} opts
 * @param {string} opts.to      - recipient address
 * @param {string} opts.subject - email subject
 * @param {string} opts.html    - HTML body
 * @param {string} [opts.text]  - plain-text body
 * @returns {Promise<{ transport: string, to: string, file?: string }>}
 */
async function sendEmail({ to, subject, html, text }) {
  if (!to) throw new Error('sendEmail: "to" is required');
  if (!subject) throw new Error('sendEmail: "subject" is required');

  // Always write a local mirror so the rendered message can be inspected
  // regardless of whether the SMTP transport actually delivered. This is the
  // first place to check when "the email didn't arrive" — the body proves
  // what we asked the provider to send.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${stamp}-${sanitizeRecipient(to)}.html`;
  const filePath = path.join(SENT_DIR, fileName);
  const document =
    `<!-- to: ${to} -->\n` +
    `<!-- from: ${env.emailFrom} -->\n` +
    `<!-- subject: ${subject} -->\n` +
    `<!-- sentAt: ${new Date().toISOString()} -->\n` +
    `<!-- transport: ${env.emailTransport} -->\n` +
    (text ? `<!--\nplain-text:\n${text}\n-->\n` : '') +
    (html || `<pre>${text || ''}</pre>`);
  try {
    fs.writeFileSync(filePath, document, 'utf8');
  } catch (writeErr) {
    console.warn('[Email] disk mirror failed:', writeErr.message);
  }

  if (env.emailTransport === 'smtp') {
    const info = await getSmtpTransport().sendMail({
      from: env.emailFrom,
      to,
      subject,
      html,
      text,
    });
    // nodemailer's `info.rejected` lists addresses the SMTP server refused
    // (e.g. Resend rejecting an unverified sender or a blocked domain). We
    // surface it here so the worker can flag the job as failed instead of
    // silently marking it completed.
    const rejected = Array.isArray(info && info.rejected) ? info.rejected : [];
    const accepted = Array.isArray(info && info.accepted) ? info.accepted : [];
    console.log(
      `[Email] sent via SMTP to=${to} subject="${subject}" ` +
        `messageId=${info && info.messageId} ` +
        `accepted=${accepted.length} rejected=${rejected.length} ` +
        `mirror=sent-emails/${fileName}` +
        (info && info.response ? ` response="${info.response}"` : '')
    );
    if (rejected.length > 0) {
      throw new Error(
        `SMTP server rejected ${rejected.length} recipient(s): ${rejected.join(', ')}`
      );
    }
    return {
      transport: 'smtp',
      to,
      messageId: info && info.messageId,
      file: filePath,
    };
  }

  console.log(
    `[Email] (dev) to=${to} subject="${subject}" -> ` +
      `sent-emails/${fileName}`
  );
  return { transport: 'dev', to, file: filePath };
}

module.exports = { sendEmail, SENT_DIR };
