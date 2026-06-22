// googleCalendarService — pulls events from the connected user's
// primary Google Calendar. Reuses the OAuth grant captured by the
// Gmail integration (same GmailConnection row), so a single Connect
// click authorises both inboxes and calendars.
//
// v1: read-only. We render events on the dashboard calendar widget
// as a separate pill type. Two-way sync (writing Profirmo bookings
// back to Google) is a future increment.

const { GmailConnection } = require('../models');
const gmailService = require('./gmailService');

const CAL_API = 'https://www.googleapis.com/calendar/v3';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toIsoStart(d) {
  // Expand a YYYY-MM-DD into an RFC3339 timestamp at start-of-day UTC.
  // Google accepts any valid RFC3339 for timeMin/timeMax — we use UTC
  // since the API call doesn't depend on the caller's tz, but the
  // returned events keep their own tz which the UI handles.
  return `${d}T00:00:00Z`;
}
function toIsoEnd(d) {
  return `${d}T23:59:59Z`;
}

/**
 * List events from the user's primary Google calendar in a date
 * window. The dashboard calendar widget calls this with the visible
 * month + a week of overspill on each side.
 *
 * Returns: [{ id, summary, start, end, htmlLink, calendarId }]
 *   * start / end are YYYY-MM-DD when all-day, full ISO otherwise.
 */
async function listEventsForUser(userId, { from, to } = {}) {
  const connection = await GmailConnection.findOne({ where: { userId } });
  if (!connection) {
    throw { statusCode: 404, message: 'No Google account connected' };
  }
  // Accept either calendar.events (current) or calendar.readonly (legacy
  // — granted by users who connected during the brief window before
  // write-back landed). Either is enough to READ events.
  const scope = String(connection.scope || '');
  if (!scope.includes('calendar.events') && !scope.includes('calendar.readonly')) {
    throw {
      statusCode: 403,
      message:
        'Calendar access not granted. Click "Change account" to re-consent with the calendar scope.',
      code: 'CALENDAR_SCOPE_MISSING',
    };
  }
  if (!from || !to) {
    throw { statusCode: 422, message: 'from and to (YYYY-MM-DD) are required' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw { statusCode: 422, message: 'from / to must be YYYY-MM-DD' };
  }

  const token = await gmailService.mintAccessToken(connection);
  const params = new URLSearchParams({
    singleEvents: 'true', // expand recurrence into individual instances
    orderBy: 'startTime',
    timeMin: toIsoStart(from),
    timeMax: toIsoEnd(to),
    maxResults: '250',
  });
  const resp = await fetch(
    `${CAL_API}/calendars/primary/events?${params.toString()}`,
    { headers: { authorization: `Bearer ${token}` } }
  );
  const json = await resp.json();
  if (!resp.ok) {
    throw {
      statusCode: 502,
      message: `Google Calendar events.list failed: ${(json.error && json.error.message) || 'unknown'}`,
    };
  }

  const events = (json.items || []).map((e) => {
    // All-day events use date; timed events use dateTime.
    const start = (e.start && (e.start.date || e.start.dateTime)) || null;
    const end = (e.end && (e.end.date || e.end.dateTime)) || null;
    const allDay = !!(e.start && e.start.date);
    return {
      id: e.id,
      summary: e.summary || '(no title)',
      start,
      end,
      allDay,
      htmlLink: e.htmlLink || null,
      calendarId: 'primary',
    };
  });
  return { connectedEmail: connection.email, events };
}

// --- Write side -------------------------------------------------------

/**
 * Locate the calendar connection for a user, returning null if none
 * exists or the calendar.events scope wasn't granted. Write callers
 * skip silently instead of throwing so booking/hearing/task creation
 * never fails just because the pro hasn't connected Google.
 */
async function findWritableConnection(userId) {
  const connection = await GmailConnection.findOne({ where: { userId } });
  if (!connection) return null;
  const scope = String(connection.scope || '');
  // calendar.events grants both read and write. calendar.readonly does
  // NOT — those users need to re-grant before write-back works.
  if (!scope.includes('calendar.events')) return null;
  return connection;
}

function isYmdOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

/**
 * Convert a Profirmo entity to a Google Calendar event body. Each
 * entity type maps to a sensible shape:
 *   * booking — 1-hour timed event starting at booking.time on
 *     booking.date.
 *   * hearing — all-day on case.nextHearingDate.
 *   * task    — all-day on dueDate.
 *   * reminder — all-day on reminder.dueDate.
 */
function buildEventBody(kind, entity) {
  if (kind === 'booking') {
    // Booking.time is "HH:MM-HH:MM" or legacy "HH:MM". Use the start.
    const time = String(entity.time || '09:00').split('-')[0];
    const date = String(entity.date || '').slice(0, 10);
    if (!isYmdOnly(date)) return null;
    const startIso = `${date}T${time}:00`;
    const endHour = (parseInt(time.split(':')[0], 10) + 1) % 24;
    const endIso = `${date}T${String(endHour).padStart(2, '0')}:${time.split(':')[1] || '00'}:00`;
    return {
      summary: `Consultation · Booking ${entity.id}`,
      description: 'Booked via Profirmo',
      start: { dateTime: startIso, timeZone: 'Asia/Kolkata' },
      end: { dateTime: endIso, timeZone: 'Asia/Kolkata' },
    };
  }
  if (kind === 'hearing') {
    const date = String(entity.nextHearingDate || '').slice(0, 10);
    if (!isYmdOnly(date)) return null;
    return {
      summary: `Hearing · ${entity.title || entity.id}`,
      description: entity.courtName
        ? `${entity.courtName}${entity.opposingParty ? ` vs ${entity.opposingParty}` : ''}`
        : 'Profirmo case hearing',
      start: { date },
      end: { date }, // Google all-day uses same date in start/end
    };
  }
  if (kind === 'task') {
    const date = String(entity.dueDate || '').slice(0, 10);
    if (!isYmdOnly(date)) return null;
    return {
      summary: `Task · ${entity.title || (entity.body || '').slice(0, 60) || 'Task'}`,
      description: entity.body || '',
      start: { date },
      end: { date },
    };
  }
  if (kind === 'reminder') {
    const date = String(entity.dueDate || '').slice(0, 10);
    if (!isYmdOnly(date)) return null;
    return {
      summary: `Reminder · ${entity.title}`,
      description: entity.note || '',
      start: { date },
      end: { date },
    };
  }
  return null;
}

/**
 * Upsert an event in the user's primary calendar. If existingEventId
 * is set, PATCHes; otherwise creates. Returns the resulting event id
 * (caller persists it on the entity row for next-time upsert).
 */
async function upsertEvent(connection, body, existingEventId = null) {
  if (!body) return null;
  const token = await gmailService.mintAccessToken(connection);
  const base = `${CAL_API}/calendars/primary/events`;

  if (existingEventId) {
    const resp = await fetch(
      `${base}/${encodeURIComponent(existingEventId)}`,
      {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
    if (resp.status === 404) {
      // Event was deleted in Google; fall through to create.
    } else {
      const json = await resp.json();
      if (!resp.ok) {
        throw {
          statusCode: 502,
          message: `Calendar upsert failed: ${(json.error && json.error.message) || 'unknown'}`,
        };
      }
      return json.id || existingEventId;
    }
  }

  const resp = await fetch(base, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await resp.json();
  if (!resp.ok) {
    throw {
      statusCode: 502,
      message: `Calendar insert failed: ${(json.error && json.error.message) || 'unknown'}`,
    };
  }
  return json.id || null;
}

async function deleteEvent(connection, eventId) {
  if (!eventId) return;
  const token = await gmailService.mintAccessToken(connection);
  await fetch(
    `${CAL_API}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }
  );
  // 404 is fine — already gone.
}

/**
 * Public push helpers — each accepts the entity row + the userId of
 * the pro whose calendar should receive the event. All are
 * fire-and-forget from the caller's perspective: failures log to
 * stderr but never propagate, so booking creation never fails just
 * because Google had a hiccup.
 */
async function pushBooking(userId, booking) {
  try {
    const conn = await findWritableConnection(userId);
    if (!conn) return null;
    const body = buildEventBody('booking', booking);
    const eventId = await upsertEvent(conn, body, booking.googleEventId);
    if (eventId && eventId !== booking.googleEventId) {
      // eslint-disable-next-line global-require
      const { Booking } = require('../models');
      await Booking.update({ googleEventId: eventId }, { where: { id: booking.id } });
    }
    return eventId;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[calendar.push booking]', err.message || err);
    return null;
  }
}

async function pushHearing(userId, caseRow) {
  try {
    const conn = await findWritableConnection(userId);
    if (!conn) return null;
    if (!caseRow.nextHearingDate) {
      // Hearing cleared → delete the previously-mirrored event.
      if (caseRow.googleHearingEventId) {
        await deleteEvent(conn, caseRow.googleHearingEventId);
        // eslint-disable-next-line global-require
        const { Case } = require('../models');
        await Case.update(
          { googleHearingEventId: null },
          { where: { id: caseRow.id } }
        );
      }
      return null;
    }
    const body = buildEventBody('hearing', caseRow);
    const eventId = await upsertEvent(conn, body, caseRow.googleHearingEventId);
    if (eventId && eventId !== caseRow.googleHearingEventId) {
      // eslint-disable-next-line global-require
      const { Case } = require('../models');
      await Case.update(
        { googleHearingEventId: eventId },
        { where: { id: caseRow.id } }
      );
    }
    return eventId;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[calendar.push hearing]', err.message || err);
    return null;
  }
}

async function pushTask(userId, caseUpdate) {
  try {
    if (!caseUpdate.dueDate) {
      // Not a task — nothing to mirror. If it previously had an event
      // (dueDate cleared), delete it.
      if (caseUpdate.googleEventId) {
        const conn = await findWritableConnection(userId);
        if (conn) await deleteEvent(conn, caseUpdate.googleEventId);
        // eslint-disable-next-line global-require
        const { CaseUpdate } = require('../models');
        await CaseUpdate.update(
          { googleEventId: null },
          { where: { id: caseUpdate.id } }
        );
      }
      return null;
    }
    const conn = await findWritableConnection(userId);
    if (!conn) return null;
    const body = buildEventBody('task', caseUpdate);
    const eventId = await upsertEvent(conn, body, caseUpdate.googleEventId);
    if (eventId && eventId !== caseUpdate.googleEventId) {
      // eslint-disable-next-line global-require
      const { CaseUpdate } = require('../models');
      await CaseUpdate.update(
        { googleEventId: eventId },
        { where: { id: caseUpdate.id } }
      );
    }
    return eventId;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[calendar.push task]', err.message || err);
    return null;
  }
}

async function pushReminder(userId, reminder) {
  try {
    const conn = await findWritableConnection(userId);
    if (!conn) return null;
    const body = buildEventBody('reminder', reminder);
    const eventId = await upsertEvent(conn, body, reminder.googleEventId);
    if (eventId && eventId !== reminder.googleEventId) {
      // eslint-disable-next-line global-require
      const { ProfessionalReminder } = require('../models');
      await ProfessionalReminder.update(
        { googleEventId: eventId },
        { where: { id: reminder.id } }
      );
    }
    return eventId;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[calendar.push reminder]', err.message || err);
    return null;
  }
}

async function deleteForBooking(userId, booking) {
  try {
    if (!booking.googleEventId) return;
    const conn = await findWritableConnection(userId);
    if (!conn) return;
    await deleteEvent(conn, booking.googleEventId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[calendar.delete booking]', err.message || err);
  }
}

async function deleteForReminder(userId, reminder) {
  try {
    if (!reminder.googleEventId) return;
    const conn = await findWritableConnection(userId);
    if (!conn) return;
    await deleteEvent(conn, reminder.googleEventId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[calendar.delete reminder]', err.message || err);
  }
}

module.exports = {
  listEventsForUser,
  pushBooking,
  pushHearing,
  pushTask,
  pushReminder,
  deleteForBooking,
  deleteForReminder,
};
