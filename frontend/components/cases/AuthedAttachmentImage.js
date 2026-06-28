'use client';

// AuthedAttachmentImage — renders an `<img>` for a private case
// attachment by fetching the bytes through the backend's auth-gated
// stream endpoint and converting the result to a blob URL.
//
// Why this exists:
//   • case-files/* is a PRIVATE S3 prefix. Unsigned URLs return
//     "Access Denied" and signed URLs leak the X-Amz-* params into
//     the page source.
//   • <img src={signedUrl}> requests don't carry our auth headers
//     and S3 sometimes rejects them on stricter bucket policies.
//   • The /api/cases/:id/attachments/stream endpoint re-authorises
//     the caller on every request and proxies the bytes — this
//     component fetches that endpoint with the bearer token and
//     wraps the response in a blob URL.

import { useEffect, useState } from 'react';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import { getApiBaseUrl, getAccessToken } from '@/services/api';

// Legacy attachments were stored with `url` set to a full signed S3
// URL like `https://bucket.s3.../case-files/<caseId>/<uuid>.jpg?X-Amz…`.
// Those signed URLs expire after 15 minutes, so the bytes are
// unreachable a few hours later. Extract the bare S3 key from the
// URL path so the stream endpoint can presign a fresh URL itself.
function normaliseAttachmentKey(raw) {
  if (!raw) return '';
  const s = String(raw);
  if (!/^https?:\/\//i.test(s)) return s;
  try {
    const u = new URL(s);
    // Strip the leading '/' so the result is a bare key, e.g.
    // `case-files/<caseId>/<uuid>.jpg`.
    return decodeURIComponent(u.pathname.replace(/^\/+/, ''));
  } catch {
    return s;
  }
}

export default function AuthedAttachmentImage({
  caseId,
  attachment,
  alt,
  className,
}) {
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');
  const key = normaliseAttachmentKey(attachment && attachment.url);

  useEffect(() => {
    let revoked = '';
    let cancelled = false;
    async function load() {
      if (!key) return;
      try {
        const token = getAccessToken();
        const url = `${getApiBaseUrl()}/api/cases/${encodeURIComponent(
          caseId
        )}/attachments/stream?key=${encodeURIComponent(key)}`;
        const res = await fetch(url, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`Failed (${res.status}).`);
        const blob = await res.blob();
        if (cancelled) return;
        const objUrl = URL.createObjectURL(blob);
        revoked = objUrl;
        setSrc(objUrl);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load image.');
      }
    }
    load();
    return () => {
      cancelled = true;
      // Revoke the blob URL when the component unmounts so we don't
      // leak memory if the user scrolls past many attachments.
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [caseId, key]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className || ''}`}
        title={error}
      >
        <ImageIcon size={18} />
      </div>
    );
  }
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className || ''}`}
      >
        <Loader2 size={16} className="animate-spin" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt || 'Attachment'} className={className} />;
}
