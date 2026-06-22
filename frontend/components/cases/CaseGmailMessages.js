'use client';

// CaseGmailMessages — inbound email surface on the case detail page.
// Pulls recent Gmail messages whose sender matches a client on this
// case. Multi-case clients: by default a matched message shows on
// EVERY case that client is on; the pro can pin a message to one
// specific case (Pin to this case) so it stops appearing on the
// others.
//
// Renders silently (no card) when Gmail isn't connected at all — the
// dashboard-level GmailIntegrationCard handles connect / disconnect /
// re-grant. We only show actionable hints when the user IS connected
// but something is off (no client emails, scope missing, error).

import { useCallback, useEffect, useState } from 'react';
import { Mail, Pin, PinOff, ExternalLink, AlertTriangle } from 'lucide-react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import {
  listMessagesForCase,
  pinMessage,
  unpinMessage,
} from '@/services/gmailIntegrationService';

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export default function CaseGmailMessages({ caseId }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyMessageId, setBusyMessageId] = useState(null);

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError('');
    try {
      const out = await listMessagesForCase(caseId);
      setState(out);
    } catch (err) {
      setError(err.message || 'Could not load Gmail messages.');
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePin(m) {
    setBusyMessageId(m.id);
    setError('');
    try {
      await pinMessage(m.id, caseId);
      await load();
    } catch (err) {
      setError(err.message || 'Could not pin message.');
    } finally {
      setBusyMessageId(null);
    }
  }

  async function handleUnpin(m) {
    setBusyMessageId(m.id);
    setError('');
    try {
      await unpinMessage(m.id);
      await load();
    } catch (err) {
      setError(err.message || 'Could not unpin message.');
    } finally {
      setBusyMessageId(null);
    }
  }

  // Silent skip when no Gmail account is connected — dashboard card
  // handles that surface. Loading shows a faint placeholder.
  if (loading) {
    return null;
  }
  if (!state || !state.connected) {
    return null;
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-600">
          <Mail size={14} />
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-900">
            Inbound mail
          </h3>
          <p className="text-xs text-slate-500">
            {state.scopeMissing
              ? 'Connected, but Gmail read access not granted yet — re-grant from the dashboard Gmail card.'
              : (state.caseClientEmails || []).length === 0
                ? 'No client email on this case — add a client with an email address to pull matching mail.'
                : `Recent messages from this case's client(s) — ${(state.caseClientEmails || []).join(', ')}.`}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="text-[11px] text-slate-500 underline hover:text-slate-700"
        >
          Refresh
        </button>
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      <div className="mt-3 space-y-2">
        {state.messages.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
            No matching messages in the recent inbox window.
          </p>
        ) : (
          state.messages.map((m) => (
            <div
              key={m.id}
              className={[
                'flex items-start gap-2 rounded-lg border px-3 py-2 transition',
                m.pinnedHere
                  ? 'border-amber-200 bg-amber-50/40'
                  : 'border-slate-200 bg-white hover:bg-slate-50',
              ].join(' ')}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {m.subject || '(no subject)'}
                  </p>
                  {m.pinnedHere && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                      <Pin size={9} />
                      Pinned here
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  From {m.from || m.fromEmail} · {fmtDate(m.date)}
                </p>
                {m.snippet && (
                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">
                    {m.snippet}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {m.pinnedHere ? (
                  <button
                    type="button"
                    onClick={() => handleUnpin(m)}
                    disabled={busyMessageId === m.id}
                    title="Stop pinning to this case"
                    className="rounded p-1 text-amber-700 hover:bg-amber-100"
                  >
                    <PinOff size={13} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePin(m)}
                    disabled={busyMessageId === m.id}
                    title="Pin to this case (hide on other cases for this client)"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Pin size={13} />
                  </button>
                )}
                <a
                  href={`https://mail.google.com/mail/u/0/#inbox/${m.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title="Open in Gmail"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
