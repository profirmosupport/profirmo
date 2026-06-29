// Email service for the Profirmo backend (Phase 6).
//
// Two delivery modes, selected by env.emailTransport:
//   'dev'  - no network: every email is rendered to an HTML file under
//            backend/sent-emails/ and a one-line summary is logged. This is
//            the default so a fresh checkout works with zero SMTP config.
//   'smtp' - a real nodemailer SMTP transport built from the live admin
//            settings (smtp_host / smtp_port / smtp_secure / smtp_user /
//            smtp_pass / smtp_from_email / smtp_from_name), with the
//            legacy env.smtp values as fallback for older deployments.
//
// Admin can rotate the SMTP credentials from /admin/settings without a
// process restart — the transport is rebuilt whenever any smtp_* setting
// changes (adminSettingsService.set() calls invalidateSmtpTransport()).
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

// Resolve a single setting value with the admin-DB → env → default chain.
// Imported lazily because adminSettingsService → secretCrypto → env, and
// env may not be fully resolved at require time on cold start.
async function readSmtpConfig() {
  // eslint-disable-next-line global-require
  const admin = require('./adminSettingsService');
  const [host, portRaw, secureRaw, user, pass, fromEmail, fromName] =
    await Promise.all([
      admin.getString('smtp_host'),
      admin.getString('smtp_port'),
      admin.getString('smtp_secure'),
      admin.getString('smtp_user'),
      admin.getString('smtp_pass'),
      admin.getString('smtp_from_email'),
      admin.getString('smtp_from_name'),
    ]);
  const port = Number(portRaw) || env.smtp.port || 587;
  const secure = String(secureRaw || '').toLowerCase() === 'true';
  return {
    host: host || env.smtp.host || '',
    port,
    secure,
    user: user || env.smtp.user || '',
    pass: pass || env.smtp.pass || '',
    fromEmail: fromEmail || env.emailFrom || '',
    fromName: fromName || 'Profirmo',
  };
}

// Memoised transport keyed by the fingerprint of the SMTP settings. Whenever
// any of the smtp_* admin settings change, the fingerprint changes too and we
// build a fresh transport on the next send. That keeps credential rotation
// instant without forcing the admin UI to know about transport invalidation.
let cachedTransport = null;
let cachedFingerprint = null;

function smtpFingerprint(cfg) {
  return [cfg.host, cfg.port, cfg.secure, cfg.user, cfg.pass].join('|');
}

async function getSmtpTransport() {
  const cfg = await readSmtpConfig();
  const fp = smtpFingerprint(cfg);
  if (cachedTransport && cachedFingerprint === fp) return { transport: cachedTransport, cfg };
  cachedTransport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user || cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
  });
  cachedFingerprint = fp;
  return { transport: cachedTransport, cfg };
}

// Public hook so adminSettingsService can drop the cached transport when
// any smtp_* setting is updated. The transport will be rebuilt on the
// next sendEmail() call.
function invalidateSmtpTransport() {
  cachedTransport = null;
  cachedFingerprint = null;
}

// Build a filesystem-safe slug from a recipient address.
const sanitizeRecipient = (to) =>
  String(to || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .slice(0, 80);

function formatFromHeader(cfg) {
  if (!cfg.fromEmail) return undefined;
  if (cfg.fromName) {
    // Quote the display name when it contains characters RFC 5322 would
    // require encoding; nodemailer handles full encoding when needed.
    return `"${cfg.fromName.replace(/"/g, '\\"')}" <${cfg.fromEmail}>`;
  }
  return cfg.fromEmail;
}

/**
 * Send an email. In 'dev' mode the message is written to disk; in 'smtp'
 * mode it is delivered through the live admin-configured SMTP transport.
 *
 * @param {object} opts
 * @param {string} opts.to      - recipient address
 * @param {string} opts.subject - email subject
 * @param {string} opts.html    - HTML body
 * @param {string} [opts.text]  - plain-text body
 * @param {string} [opts.from]  - override From header (defaults to admin setting)
 * @returns {Promise<{ transport: string, to: string, file?: string }>}
 */
async function sendEmail({ to, subject, html, text, from }) {
  if (!to) throw new Error('sendEmail: "to" is required');
  if (!subject) throw new Error('sendEmail: "subject" is required');

  // Always write a local mirror so the rendered message can be inspected
  // regardless of whether the SMTP transport actually delivered. This is the
  // first place to check when "the email didn't arrive" — the body proves
  // what we asked the provider to send.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${stamp}-${sanitizeRecipient(to)}.html`;
  const filePath = path.join(SENT_DIR, fileName);

  const fromHeaderForMirror = from || (env.emailFrom || '');
  const document =
    `<!-- to: ${to} -->\n` +
    `<!-- from: ${fromHeaderForMirror} -->\n` +
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

  // Effective transport: prefer real SMTP whenever the admin has wired
  // a host + auth in /admin/settings, even if env.emailTransport is
  // still 'dev'. That way an operator can flip the platform from dev
  // mirroring to live SMTP without touching env vars / restarting.
  const { transport, cfg } = await getSmtpTransport();
  const credentialsReady = !!(cfg.host && cfg.user && cfg.pass);
  const effectiveTransport =
    env.emailTransport === 'smtp' || credentialsReady ? 'smtp' : 'dev';

  if (effectiveTransport === 'smtp') {
    const fromHeader = from || formatFromHeader(cfg) || env.emailFrom;
    const info = await transport.sendMail({
      from: fromHeader,
      to,
      subject,
      html,
      text,
    });
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

/**
 * Send a one-off raw email using the live admin SMTP transport — bypasses
 * the env.emailTransport gate, so the admin's "test" button works even
 * when the runtime is still in dev mode. Used only by the test endpoint.
 */
async function sendTestEmail({ to, subject, html, text }) {
  if (!to) throw new Error('sendTestEmail: "to" is required');
  const { transport, cfg } = await getSmtpTransport();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    throw {
      statusCode: 422,
      message:
        'SMTP host / user / password are not set. Fill in the SMTP settings, save them, then try again.',
    };
  }
  const fromHeader = formatFromHeader(cfg) || cfg.fromEmail || cfg.user;
  const info = await transport.sendMail({
    from: fromHeader,
    to,
    subject: subject || 'Profirmo SMTP test',
    html: html || '<p>This is a test from /admin/settings → SMTP.</p>',
    text: text || 'This is a test from /admin/settings → SMTP.',
  });
  return {
    messageId: info && info.messageId,
    accepted: info && info.accepted,
    rejected: info && info.rejected,
    response: info && info.response,
    from: fromHeader,
  };
}

module.exports = {
  sendEmail,
  sendTestEmail,
  invalidateSmtpTransport,
  SENT_DIR,
};
