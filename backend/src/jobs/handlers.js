// Background-job handler registry for the Profirmo backend (Phase 6).
//
// Each entry maps a job `type` to an async handler(payload). The worker
// (src/jobs/worker.js) looks up the handler by type and runs it. A handler
// should throw on failure so the worker can retry / mark the job failed.

const emailService = require('../services/emailService');
const emailTemplateService = require('../services/emailTemplateService');
const notificationService = require('../services/notificationService');

/**
 * 'email' job handler.
 * Payload is either an explicit message:
 *   { to, subject, html, text }
 * or a template reference:
 *   { to, template, vars }
 */
async function emailHandler(payload = {}) {
  const { to } = payload;
  if (!to) throw new Error('email job: "to" is required');

  let message;
  if (payload.template) {
    // emailTemplateService.renderForSend prefers the admin-edited row
    // from `email_templates`; falls back to the hardcoded TEMPLATES
    // registry when no custom version exists or it's disabled.
    const rendered = await emailTemplateService.renderForSend(
      payload.template,
      payload.vars || {}
    );
    message = { to, ...rendered };
  } else {
    message = {
      to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    };
  }
  await emailService.sendEmail(message);
}

/**
 * 'notification' job handler — creates an in-app notification.
 * Payload: { userId, type, title, message, link, metadata }
 */
async function notificationHandler(payload = {}) {
  if (!payload.userId) throw new Error('notification job: "userId" is required');
  await notificationService.createNotification({
    userId: payload.userId,
    type: payload.type || 'system',
    title: payload.title || 'Notification',
    message: payload.message || '',
    link: payload.link || null,
    metadata: payload.metadata || null,
  });
}

// Registry keyed by job type.
const handlers = {
  email: emailHandler,
  notification: notificationHandler,
};

/**
 * Look up a handler by job type.
 * @param {string} type
 * @returns {Function|undefined}
 */
function getHandler(type) {
  return handlers[type];
}

module.exports = { handlers, getHandler };
