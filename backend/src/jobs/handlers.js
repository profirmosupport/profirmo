// Background-job handler registry for the Profirmo backend (Phase 6).
//
// Each entry maps a job `type` to an async handler(payload). The worker
// (src/jobs/worker.js) looks up the handler by type and runs it. A handler
// should throw on failure so the worker can retry / mark the job failed.

const emailService = require('../services/emailService');
const emailTemplateService = require('../services/emailTemplateService');
const notificationService = require('../services/notificationService');
const aiBlogService = require('../services/aiBlogService');
const queueService = require('../services/queueService');

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
 * 'ai-blog-generate' job handler — runs the full 4-step AI blog
 * generation flow and IMMEDIATELY enqueues the next run for tomorrow
 * at 03:00 IST. The reschedule happens FIRST so a transient Claude /
 * Unsplash outage can't break the daily chain.
 */
async function aiBlogGenerateHandler(payload = {}) {
  // Step 0: queue tomorrow's run before doing any work. If THIS job
  // fails permanently the worker still won't drop the schedule.
  try {
    await queueService.enqueue(
      'ai-blog-generate',
      {},
      { runAt: nextDailyRunAt() }
    );
  } catch (err) {
    console.warn(
      '[Worker] could not schedule next ai-blog-generate run:',
      (err && err.message) || err
    );
  }

  // Skip guard: only suppress a run when THIS cron ran recently —
  // NOT when a human clicked "Generate with AI" during the day.
  // We look at the jobs table for another completed
  // ai-blog-generate job in the last 22h (a bit under 24h so a
  // clock-skewed run doesn't push tomorrow off-schedule). Manual
  // /admin/blog runs never touch the jobs table, so they no longer
  // gate the cron.
  if (!payload.force) {
    const sequelize = require('../config/database');
    const [[recent]] = await sequelize.query(
      `SELECT id, runAt FROM jobs
       WHERE type = 'ai-blog-generate'
         AND status = 'completed'
         AND runAt >= DATE_SUB(NOW(), INTERVAL 22 HOUR)
         AND id <> :selfId
       ORDER BY runAt DESC LIMIT 1`,
      {
        replacements: { selfId: payload.__jobId || '' },
        raw: true,
      }
    );
    if (recent) {
      console.log(
        `[Worker] ai-blog-generate: previous run at ${recent.runAt} already completed within 22h — skipping to avoid a double-post from a backlog catch-up.`
      );
      return;
    }
  }

  await aiBlogService.generateBlogPostDraft();
}

/**
 * Compute the next 03:00 IST instant in UTC. IST is fixed UTC+05:30
 * (no DST), so we can do it deterministically without a tz library.
 */
function nextDailyRunAt() {
  // 03:00 IST = 21:30 UTC the previous day.
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    21,
    30,
    0,
    0
  ));
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
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
  'ai-blog-generate': aiBlogGenerateHandler,
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
