'use client';

// CaseAuditTrail — read-only timeline of every recorded mutation on
// one case (create / update / delete). Renders newest-first; click an
// entry to expand the before/after JSON diff.

import { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import Card from '@/components/common/Card';
import { listForEntity } from '@/services/auditService';

const ACTION_META = {
  create: { label: 'Created', icon: Plus, tint: 'text-emerald-600 bg-emerald-50' },
  update: { label: 'Updated', icon: Pencil, tint: 'text-blue-600 bg-blue-50' },
  delete: { label: 'Deleted', icon: Trash2, tint: 'text-rose-600 bg-rose-50' },
};

function formatTs(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function isEmpty(obj) {
  return !obj || (typeof obj === 'object' && Object.keys(obj).length === 0);
}

export default function CaseAuditTrail({ caseId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError('');
    try {
      const rows = await listForEntity('case', caseId);
      setEvents(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.message || 'Failed to load audit trail.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(id) {
    setExpanded((m) => ({ ...m, [id]: !m[id] }));
  }

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck size={16} className="text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900">Audit trail</h3>
        <span className="text-xs text-slate-500">
          Every change recorded with actor, time and IP. Append-only.
        </span>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">Loading audit trail…</p>
      ) : events.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
          No changes recorded yet. New activity will appear here automatically.
        </p>
      ) : (
        <ol className="relative space-y-2 border-l border-slate-200 pl-4">
          {events.map((e) => {
            const meta = ACTION_META[e.action] || {
              label: e.action,
              icon: Pencil,
              tint: 'text-slate-600 bg-slate-100',
            };
            const Icon = meta.icon;
            const open = !!expanded[e.id];
            const hasDetails = !isEmpty(e.before) || !isEmpty(e.after);
            return (
              <li key={e.id} className="relative">
                <span
                  className={`absolute -left-[22px] top-1 inline-flex h-4 w-4 items-center justify-center rounded-full ${meta.tint}`}
                >
                  <Icon size={10} />
                </span>
                <button
                  type="button"
                  onClick={() => hasDetails && toggle(e.id)}
                  className={`flex w-full items-start justify-between gap-3 rounded-md px-2 py-1.5 text-left transition ${
                    hasDetails ? 'hover:bg-slate-50' : 'cursor-default'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800">
                      <span className="mr-1">{meta.label}</span>
                      {e.summary && (
                        <span className="font-normal text-slate-600">
                          — {e.summary}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {formatTs(e.createdAt)}
                      {e.actorRole && ` · ${e.actorRole}`}
                      {e.ip && ` · ${e.ip}`}
                    </p>
                  </div>
                  {hasDetails &&
                    (open ? (
                      <ChevronDown size={12} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={12} className="text-slate-400" />
                    ))}
                </button>
                {open && hasDetails && (
                  <div className="mt-1 grid grid-cols-1 gap-2 px-2 sm:grid-cols-2">
                    {!isEmpty(e.before) && (
                      <div className="rounded-md bg-rose-50 p-2">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                          Before
                        </p>
                        <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[11px] text-slate-700">
                          {JSON.stringify(e.before, null, 2)}
                        </pre>
                      </div>
                    )}
                    {!isEmpty(e.after) && (
                      <div className="rounded-md bg-emerald-50 p-2">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                          After
                        </p>
                        <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[11px] text-slate-700">
                          {JSON.stringify(e.after, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
