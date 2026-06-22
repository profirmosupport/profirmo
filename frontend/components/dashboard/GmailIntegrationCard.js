'use client';

// GmailIntegrationCard — connect/disconnect/sync Gmail from the
// professional dashboard. After `Connect Gmail`, the browser is sent
// to Google for consent and bounces back to /dashboard/professional
// with ?gmail=connected | ?gmail=error&reason=… — the parent page is
// expected to surface that toast (or we can hook it inside this card).

import { useCallback, useEffect, useState } from 'react';
import { Mail, RefreshCw, Trash2, ExternalLink, AlertTriangle } from 'lucide-react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import {
  getStatus,
  startConnectFlow,
  sync as gmailSync,
  disconnect as gmailDisconnect,
} from '@/services/gmailIntegrationService';

function fmt(ts) {
  if (!ts) return 'never';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString();
}

export default function GmailIntegrationCard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const row = await getStatus();
      setStatus(row);
    } catch (err) {
      setError(err.message || 'Could not load Gmail status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // After a callback redirect, the URL has ?gmail=connected | error.
    // Reflect that in the card by stripping the param after one read.
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tag = params.get('gmail');
      if (tag === 'error') {
        setError(`Gmail connect failed: ${params.get('reason') || 'unknown'}`);
      }
      if (tag) {
        params.delete('gmail');
        params.delete('reason');
        params.delete('email');
        const next = params.toString();
        window.history.replaceState(
          {},
          '',
          window.location.pathname + (next ? `?${next}` : '')
        );
      }
    }
  }, [load]);

  async function handleConnect() {
    setBusy(true);
    setError('');
    try {
      await startConnectFlow();
    } catch (err) {
      setError(err.message || 'Could not start Gmail OAuth.');
      setBusy(false);
    }
  }

  async function handleSync() {
    setBusy(true);
    setError('');
    setMatches(null);
    try {
      const out = await gmailSync();
      setMatches(out);
      await load();
    } catch (err) {
      setError(err.message || 'Sync failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('Disconnect Gmail? You can reconnect anytime.')) return;
    setBusy(true);
    setError('');
    try {
      await gmailDisconnect();
      setMatches(null);
      await load();
    } catch (err) {
      setError(err.message || 'Disconnect failed.');
    } finally {
      setBusy(false);
    }
  }

  const isConnected = status && status.email;

  return (
    <Card>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600">
            <Mail size={16} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Gmail integration
            </h3>
            <p className="text-xs text-slate-500">
              {loading
                ? 'Checking status…'
                : isConnected
                  ? `Connected as ${status.email}`
                  : 'Auto-link inbound mail to your cases by sender email.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSync}
                disabled={busy}
              >
                <RefreshCw size={14} />
                {busy ? 'Syncing…' : 'Sync inbox'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDisconnect}
                disabled={busy}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} />
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={handleConnect} disabled={busy || loading}>
              <ExternalLink size={14} />
              Connect Gmail
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {isConnected && (
        <p className="mt-2 text-[11px] text-slate-400">
          Last synced: {fmt(status.lastSyncedAt)}
        </p>
      )}

      {matches && (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
          <p className="font-medium text-slate-700">
            Fetched {matches.fetchedMessageCount || 0} message(s) — matched{' '}
            {matches.matches ? matches.matches.length : 0} to your cases.
          </p>
          {matches.matches && matches.matches.length > 0 && (
            <ul className="mt-2 space-y-1">
              {matches.matches.slice(0, 5).map((m) => (
                <li key={m.message.id} className="text-slate-700">
                  <span className="font-medium">{m.message.subject}</span>{' '}
                  <span className="text-slate-500">
                    from {m.client.name || m.client.email}
                  </span>{' '}
                  →{' '}
                  {m.cases.map((c) => (
                    <a
                      key={c.id}
                      href={`/dashboard/professional/cases/${c.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {c.title || c.id}
                    </a>
                  ))}
                </li>
              ))}
              {matches.matches.length > 5 && (
                <li className="text-slate-500">
                  +{matches.matches.length - 5} more…
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
