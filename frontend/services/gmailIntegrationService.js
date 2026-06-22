// gmailIntegrationService — frontend wrapper for /api/integrations/gmail.

import { get, post, del, API_BASE_URL, getAccessToken } from '@/services/api';

function unwrap(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

/**
 * Kick off the OAuth flow. /connect is a GET that 302s to Google, which
 * standard `fetch` follows and breaks (CORS). So we just navigate the
 * top-level window with the access token in a query param — the
 * authenticate middleware accepts the Bearer header OR a `?token=` for
 * convenience navigations like this. (See authMiddleware for the
 * accepted shapes.)
 *
 * If the token-via-querystring is not yet supported, we instead grab
 * the URL through a small JSON helper endpoint (TODO once needed). For
 * v1 we open a popup-style top navigation directly to /connect since
 * the browser already sends auth via the in-page api.js bearer.
 */
export function startConnectFlow() {
  // Server side, /connect returns a 302 to Google. Browsers follow the
  // redirect automatically when we navigate via window.location, but
  // they don't attach the Authorization header on the redirect. So we
  // ask the backend for the URL via fetch (auth header attached), then
  // navigate window.location.
  return get('/api/integrations/gmail/connect/url')
    .then((res) => unwrap(res))
    .then((data) => {
      if (data && data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Could not get Gmail OAuth URL');
      }
    });
}

export async function getStatus() {
  const res = await get('/api/integrations/gmail/me');
  return unwrap(res);
}

export async function sync() {
  const res = await post('/api/integrations/gmail/sync', {});
  return unwrap(res);
}

export async function disconnect() {
  const res = await del('/api/integrations/gmail');
  return unwrap(res);
}

/**
 * Pull Google Calendar events in a date window so the dashboard
 * calendar can overlay them. Returns:
 *   { connectedEmail, events: [{ id, summary, start, end, allDay, htmlLink }] }
 * Throws with code='CALENDAR_SCOPE_MISSING' when the existing Google
 * grant predates the calendar.readonly scope add.
 */
export async function listCalendarEvents({ from, to } = {}) {
  const res = await get('/api/integrations/google/calendar/events', {
    params: { from, to },
  });
  return unwrap(res) || { events: [] };
}
