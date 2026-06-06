// Resolve a backend image URL. The API returns one of three shapes:
//   `https://...`                   → already absolute (signed S3 URLs, external links)
//   `/uploads/abc.jpg`              → backend serves user uploads
//   `/blog-images/foo.png`          → frontend (profirmo.com) serves blog assets
//   `profile-images/<uuid>.jpg`     → bare S3 key, resolved via CDN base
//
// Bare S3 keys require the storage public config fetched from
// /api/app-settings/storage. That config is cached in module state and
// primed lazily on first call.

import { API_BASE_URL } from '../config/api';

const FRONTEND_STATIC_BASE = 'https://profirmo.com';
const FRONTEND_PREFIXES = ['/blog-images/', '/images/', '/static/'];

let storageConfigCache = null;
let storageConfigPromise = null;

async function fetchStorageConfig() {
  if (storageConfigCache) return storageConfigCache;
  if (storageConfigPromise) return storageConfigPromise;
  storageConfigPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/app-settings/storage`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = await res.json();
      storageConfigCache = (json && (json.data || json)) || {
        driver: 'local',
        baseUrl: '',
      };
    } catch {
      storageConfigCache = { driver: 'local', baseUrl: '' };
    }
    return storageConfigCache;
  })();
  return storageConfigPromise;
}

/** Force a refresh after the admin flips storage settings. */
export function invalidateStorageConfig() {
  storageConfigCache = null;
  storageConfigPromise = null;
}

// Prime on first import so the very first image render lands a
// correctly-resolved URL (the fetch usually completes well before any
// async screen mounts).
fetchStorageConfig().catch(() => {});

export function imageUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) {
    if (FRONTEND_PREFIXES.some((p) => raw.startsWith(p))) {
      return `${FRONTEND_STATIC_BASE}${raw}`;
    }
    return `${API_BASE_URL}${raw}`;
  }
  // Bare key (`profile-images/<uuid>.jpg` etc) — needs the S3 base URL.
  const cfg = storageConfigCache || { driver: 'local', baseUrl: '' };
  if (cfg.driver === 's3' && cfg.baseUrl) {
    return `${cfg.baseUrl.replace(/\/$/, '')}/${raw}`;
  }
  // Fallback: ask the backend to serve it. Works as long as
  // /uploads/<key> mirrors the S3 prefix structure on disk (the local
  // driver in storageService already writes that way).
  return `${API_BASE_URL}/uploads/${raw}`;
}
