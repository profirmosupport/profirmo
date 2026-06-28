'use client';

// Renders an authorisation-gated link to a case attachment.
//
// On click, the browser fetches the file BYTES from the backend with
// the user's bearer token. The backend re-authorises (case access +
// key-belongs-to-case) on every request, then proxies the S3 object
// body through. The browser only ever sees a temporary object URL
// pointing at an in-memory blob — there is no signed S3 URL to leak.
//
// Right-click "copy link" copies `/api/cases/<id>/attachments/stream?key=…`
// which is useless to an unauthenticated stranger (returns 401), and
// useless to an authorised user trying to share it with someone
// outside the case (returns 403 for them).
//
// Legacy `/uploads/*` paths are still rendered via the static handler —
// they were never in S3 to begin with.

import { useState } from 'react';

import {
  getApiBaseUrl,
  getAccessToken,
} from '@/services/api';
import { resolveFileUrl } from '@/services/fileService';

// Legacy `/uploads/<file>` paths bypass S3 entirely — those are served
// straight from the backend static handler, no presign needed.
const isLegacyServedByBackend = (key) =>
  !!key && String(key).startsWith('/uploads/');

// Pull the bare S3 key out of a full signed URL. The DB used to store
// the entire signed URL as the attachment record's `url`; the
// signature has long since expired so we re-presign on every fetch.
function toBareKey(raw) {
  if (!raw) return '';
  const s = String(raw);
  if (!/^https?:\/\//i.test(s)) return s;
  try {
    const u = new URL(s);
    return decodeURIComponent(u.pathname.replace(/^\/+/, ''));
  } catch {
    return s;
  }
}

async function fetchAttachmentBlob(caseId, key) {
  const token = getAccessToken();
  const url = `${getApiBaseUrl()}/api/cases/${encodeURIComponent(
    caseId
  )}/attachments/stream?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let msg = `Failed to load attachment (${res.status}).`;
    try {
      const j = await res.clone().json();
      if (j && j.message) msg = j.message;
    } catch {
      /* keep generic */
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') || '';
  const match = cd.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : key.split('/').pop();
  return { blob, filename };
}

export default function CaseAttachmentLink({
  caseId,
  attachment,
  className = '',
  children,
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const rawKey = attachment && attachment.url;
  if (!rawKey) return null;
  // Legacy `/uploads/<file>` paths render as plain anchors; they never
  // went through S3 so they don't need the proxy.
  if (isLegacyServedByBackend(rawKey)) {
    return (
      <a
        href={resolveFileUrl(rawKey) || rawKey}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }
  // Strip any signed-URL wrapper to recover the bare S3 key.
  const key = toBareKey(rawKey);

  async function handleClick(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      const { blob, filename } = await fetchAttachmentBlob(caseId, key);
      const objUrl = URL.createObjectURL(blob);
      // Open the blob in a new tab. Revoke the URL on a short delay so
      // the new tab has time to load it but it doesn't linger in memory.
      const win = window.open(objUrl, '_blank', 'noopener,noreferrer');
      if (!win) {
        // Popup blocker — fall back to a manual download anchor.
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = filename || 'attachment';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(objUrl), 30_000);
    } catch (e2) {
      setErr(e2.message || 'Could not load this attachment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <a
        href="#"
        onClick={handleClick}
        className={className}
        title={busy ? 'Loading…' : undefined}
      >
        {children}
      </a>
      {err && (
        <span className="ml-1 text-[11px] text-red-600" role="alert">
          {err}
        </span>
      )}
    </>
  );
}
