'use client';

// CaseAttachmentList — renders a note/update's attachments inline:
//   • Images       → 64×64 thumbnail row (square, rounded). Tap opens
//                    the proxied blob in a new tab.
//   • PDFs / docs  → paperclip pill with filename. Tap opens in a
//                    new tab too. The browser handles PDF rendering;
//                    Word/Office docs trigger a download or open in
//                    Google Docs Viewer / Office Online depending on
//                    the user's browser default.
// Both paths use CaseAttachmentLink so the request is auth-gated
// through `/api/cases/:id/attachments/stream`.

import { Paperclip } from 'lucide-react';
import CaseAttachmentLink from '@/components/cases/CaseAttachmentLink';
import AuthedAttachmentImage from '@/components/cases/AuthedAttachmentImage';

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|heic|heif|bmp)(\?|$)/i;

function isImageAttachment(att) {
  if (!att) return false;
  if (att.mimeType && String(att.mimeType).startsWith('image/')) return true;
  if (att.mimetype && String(att.mimetype).startsWith('image/')) return true;
  if (att.type && String(att.type).startsWith('image/')) return true;
  const url = String(att.url || att.name || '');
  return IMAGE_EXT_RE.test(url);
}

// Pretty filename for legacy rows where `name` was accidentally set
// to a signed S3 URL (or its tail with `X-Amz-…` query params).
// Drops everything after `?`, strips path segments, falls back to a
// generic label if nothing usable remains.
function prettyName(att, index) {
  const candidates = [att && att.name, att && att.url];
  for (const c of candidates) {
    if (!c) continue;
    const s = String(c);
    // Drop query (signed-URL params live here).
    const noQs = s.split('?')[0];
    // Drop path segments — bare key or full URL both reduce to file.
    const tail = noQs.split('/').pop();
    if (tail && tail.length > 0 && tail.length < 80) return tail;
  }
  return `Attachment ${index + 1}`;
}

export default function CaseAttachmentList({ caseId, attachments }) {
  if (!Array.isArray(attachments) || attachments.length === 0) return null;
  const images = [];
  const others = [];
  for (const a of attachments) {
    if (isImageAttachment(a)) images.push(a);
    else others.push(a);
  }
  return (
    <div className="mt-2 space-y-2">
      {images.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {images.map((a, i) => {
            const label = prettyName(a, i);
            return (
              <li key={`img-${i}`}>
                <CaseAttachmentLink
                  caseId={caseId}
                  attachment={a}
                  className="block overflow-hidden rounded-lg border border-slate-200 transition hover:border-blue-300"
                >
                  {/* Auth-gated preview — fetches the bytes through
                      /api/cases/:id/attachments/stream so private S3
                      objects render without leaking signed URLs. */}
                  <AuthedAttachmentImage
                    caseId={caseId}
                    attachment={a}
                    alt={label}
                    className="h-16 w-16 object-cover"
                  />
                </CaseAttachmentLink>
              </li>
            );
          })}
        </ul>
      )}
      {others.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {others.map((a, i) => (
            <li key={`doc-${i}`}>
              <CaseAttachmentLink
                caseId={caseId}
                attachment={a}
                className="inline-flex max-w-full items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                <Paperclip size={10} className="shrink-0 text-slate-400" />
                <span className="truncate">{prettyName(a, i)}</span>
              </CaseAttachmentLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
