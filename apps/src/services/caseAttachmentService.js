// caseAttachmentService — resolves a stored attachment key into a
// short-lived presigned URL so the device's <Image> / Linking.openURL
// can actually load it. The backend gates each lookup against the
// case's auth, so leaked URLs expire in ~5 minutes and can't be re-
// signed without re-auth.
//
// Mobile previously rendered attachments via the bare imageUrl()
// helper which only works for full http(s) URLs or `/uploads/...` paths.
// S3-stored case files (keys like `case-files/<caseId>/<uuid>.jpg`)
// returned 403 because the bucket is private. Routing through this
// service fixes that.

import { apiGet, unwrap } from './api';
import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../config/api';

// In-memory cache keyed by `${caseId}::${key}`. URLs are valid for
// 5 minutes server-side; we hold the cache entry for 4 minutes to
// stay safely inside that window and avoid surprise 403s on slow
// renders. A single resolution in-flight at a time per key
// (`inflight` map) so the rapid double-render of an update doesn't
// fire duplicate signing requests.
const cache = new Map(); // key → { url, expiresAt }
const inflight = new Map(); // key → Promise<string>
const CACHE_HOLD_MS = 4 * 60 * 1000;

function cacheKey(caseId, key) {
  return `${caseId}::${key}`;
}

export function getCachedSignedUrl(caseId, key) {
  const entry = cache.get(cacheKey(caseId, key));
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    cache.delete(cacheKey(caseId, key));
    return null;
  }
  return entry.url;
}

export async function getCaseAttachmentSignedUrl(caseId, key) {
  if (!caseId || !key) return null;
  const hit = getCachedSignedUrl(caseId, key);
  if (hit) return hit;
  const id = cacheKey(caseId, key);
  if (inflight.has(id)) return inflight.get(id);
  const promise = (async () => {
    try {
      const qs = `?key=${encodeURIComponent(key)}`;
      const res = await apiGet(
        `/api/cases/${encodeURIComponent(caseId)}/attachments/url${qs}`
      );
      const data = unwrap(res) || {};
      if (data.url) {
        cache.set(id, {
          url: data.url,
          expiresAt: Date.now() + CACHE_HOLD_MS,
        });
        return data.url;
      }
      return null;
    } catch {
      return null;
    } finally {
      inflight.delete(id);
    }
  })();
  inflight.set(id, promise);
  return promise;
}

// Some legacy attachment rows hold a fully-signed S3 URL whose signature
// has long since expired (the resigned URL was persisted instead of
// the key). When we spot one we extract the bucket-relative key and
// re-route through the backend's signing endpoint so the image loads.
const STALE_S3_HOST_RE = /^https?:\/\/[^/]+\.amazonaws\.com\//i;
function extractKeyIfStaleS3(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  if (!STALE_S3_HOST_RE.test(rawUrl)) return null;
  // Strip the query string (X-Amz-* params); the bucket prefix is
  // everything between the host and the first `?`.
  const noQs = rawUrl.split('?')[0];
  const m = noQs.match(/^https?:\/\/[^/]+\/(.+)$/i);
  const key = m ? decodeURIComponent(m[1]) : null;
  if (!key) return null;
  // Only retry-sign known case prefixes so we don't accidentally
  // resign an externally-hosted asset just because it lives on
  // amazonaws.com.
  if (
    key.startsWith('case-files/') ||
    key.startsWith('users/') ||
    key.startsWith('booking-files/') ||
    key.startsWith('profile-photos/') ||
    key.startsWith('case-attachments/')
  ) {
    return key;
  }
  return null;
}

// Determine whether a stored URL needs server-side signing. Anything
// that's already an absolute URL OR a `/uploads/...` path is served
// directly by the backend without a signature dance — EXCEPT the
// stale-signed-S3-URL case above, which we treat as if it were a
// bare key.
function needsSigning(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  if (extractKeyIfStaleS3(rawUrl)) return true;
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return false;
  if (rawUrl.startsWith('//')) return false;
  if (rawUrl.startsWith('/uploads/')) return false;
  if (rawUrl.startsWith('/')) return false;
  return true;
}

function directUrl(rawUrl) {
  if (!rawUrl) return null;
  if (extractKeyIfStaleS3(rawUrl)) return null; // needs signing
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
  if (rawUrl.startsWith('//')) return `https:${rawUrl}`;
  if (rawUrl.startsWith('/')) return `${API_BASE_URL}${rawUrl}`;
  return null;
}

/**
 * React hook — resolves an attachment's storage key into a fetchable
 * URL. Returns `{ uri, loading }` for the consumer to drive an
 * <Image> source or a Linking.openURL handler. Re-runs only when the
 * (caseId, rawUrl) tuple changes.
 */
export function useCaseAttachmentUrl(caseId, rawUrl) {
  const direct = directUrl(rawUrl);
  const [uri, setUri] = useState(direct || null);
  const [loading, setLoading] = useState(!direct && !!rawUrl && needsSigning(rawUrl));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!rawUrl) {
      setUri(null);
      setLoading(false);
      return;
    }
    const d = directUrl(rawUrl);
    if (d) {
      setUri(d);
      setLoading(false);
      return;
    }
    if (!needsSigning(rawUrl) || !caseId) {
      setUri(null);
      setLoading(false);
      return;
    }
    // Normalise: stale-signed S3 URLs collapse to their bare key so
    // the cache lookup hits the same entry regardless of which form
    // the DB row carried.
    const lookupKey = extractKeyIfStaleS3(rawUrl) || rawUrl;
    const cached = getCachedSignedUrl(caseId, lookupKey);
    if (cached) {
      setUri(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    setUri(null);
    getCaseAttachmentSignedUrl(caseId, lookupKey).then((resolved) => {
      if (!mountedRef.current) return;
      setUri(resolved || null);
      setLoading(false);
    });
  }, [caseId, rawUrl]);

  return { uri, loading };
}
