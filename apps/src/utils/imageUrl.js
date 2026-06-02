// Resolve a backend image URL. The API returns relative paths like:
//   /uploads/abc.jpg          → backend (Render) serves user uploads
//   /blog-images/foo.png      → frontend (profirmo.com) serves blog assets
//
// Absolute http(s) URLs are passed through untouched so this helper is
// safe to call on any image field.

import { API_BASE_URL } from '../config/api';

// Frontend domain hosts blog images, brand illustrations and other
// statics that don't live with the API. Override at build time if you
// host the static site somewhere else.
const FRONTEND_STATIC_BASE = 'https://profirmo.com';

const FRONTEND_PREFIXES = ['/blog-images/', '/images/', '/static/'];

export function imageUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (!raw.startsWith('/')) return raw;
  // Statics that ship with the frontend live on the public domain.
  if (FRONTEND_PREFIXES.some((p) => raw.startsWith(p))) {
    return `${FRONTEND_STATIC_BASE}${raw}`;
  }
  // Everything else (user uploads, etc.) is served by the API.
  return `${API_BASE_URL}${raw}`;
}
