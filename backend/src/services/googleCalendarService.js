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
  if (!String(connection.scope || '').includes('calendar.readonly')) {
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

module.exports = { listEventsForUser };
