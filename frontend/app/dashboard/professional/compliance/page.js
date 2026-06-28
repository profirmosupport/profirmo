'use client';

// /dashboard/professional/compliance — upcoming tax / legal compliance
// obligations across every client this pro manages. Surface aims:
//
//   1. Fast scan: rows grouped by due date, overdue items highlighted.
//   2. Quick action: mark done / not_applicable inline.
//   3. Entry point to per-client profile setup (the rule generator
//      needs an entity-type + GSTIN to produce useful rows).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Receipt,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
  Search,
  ChevronDown,
  X,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import {
  listObligations,
  updateObligation,
  uploadObligationAttachment,
  getObligationAttachmentUrl,
  softDeleteObligation,
} from '@/services/complianceService';
import clientService from '@/services/clientService';
import Modal from '@/components/common/Modal';
import { ROLES } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';

const STATUS_VARIANT = {
  pending: 'amber',
  done: 'green',
  missed: 'red',
  not_applicable: 'gray',
};

const STATUS_LABEL = {
  pending: 'Pending',
  done: 'Done',
  missed: 'Missed',
  not_applicable: 'N/A',
};

function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function CompliancePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('pending');
  const [busyId, setBusyId] = useState(null);

  // Client picker — pre-loaded once on mount. Filtering is client-side
  // because the obligations list endpoint doesn't yet accept a
  // clientUserId query param and the schedule is small enough that
  // narrowing in memory is instant.
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const clientById = useMemo(() => {
    const m = new Map();
    for (const c of clients) m.set(c.id, c);
    return m;
  }, [clients]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await clientService.getAll({ limit: 500 });
        const data = (res && res.data) || [];
        if (active) setClients(Array.isArray(data) ? data : []);
      } catch {
        if (active) setClients([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listObligations({
        status: filter === 'all' ? undefined : filter,
      });
      setItems(rows);
    } catch (err) {
      setError(err.message || 'Could not load compliance obligations.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  // Narrow the visible list (and the KPI counts below) to the picked
  // client so the page becomes a per-client view when one is chosen.
  const visibleItems = useMemo(() => {
    if (!selectedClientId) return items;
    return items.filter((it) => it.clientUserId === selectedClientId);
  }, [items, selectedClientId]);

  async function setStatus(item, status) {
    setBusyId(item.id);
    try {
      await updateObligation(item.id, { status });
      await load();
    } catch (err) {
      setError(err.message || 'Could not update obligation.');
    } finally {
      setBusyId(null);
    }
  }

  // 'Mark done' opens this modal — completion requires a short note
  // and lets the pro attach a supporting file (challan, ack, etc.).
  const [doneItem, setDoneItem] = useState(null);
  // Soft-delete opens a separate modal that requires a reason. Rows
  // stay in the DB for audit, just disappear from the default list.
  const [deleteItem, setDeleteItem] = useState(null);

  const today = todayIso();
  const overdue = visibleItems.filter(
    (i) => i.status === 'pending' && i.dueDate < today
  ).length;
  const dueThisWeek = visibleItems.filter((i) => {
    if (i.status !== 'pending') return false;
    const week = new Date();
    week.setDate(week.getDate() + 7);
    const wk = week.toISOString().slice(0, 10);
    return i.dueDate >= today && i.dueDate <= wk;
  }).length;

  return (
    <DashboardLayout
      role={ROLES.PROFESSIONAL}
      title="Compliance"
      subtitle="Upcoming filings + statutory deadlines across your clients"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Overdue
            </p>
            <p className="mt-1 text-2xl font-semibold text-red-600">
              {overdue}
            </p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Due in next 7 days
            </p>
            <p className="mt-1 text-2xl font-semibold text-amber-600">
              {dueThisWeek}
            </p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Total visible
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-800">
              {visibleItems.length}
            </p>
          </Card>
        </div>

        {/* Per-client filter — searchable dropdown. Pre-loads every
            client the pro can see; client-side filter narrows the
            obligation list and the KPI counts above without a
            network round trip. */}
        <ClientPicker
          clients={clients}
          value={selectedClientId}
          onChange={setSelectedClientId}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
            {[
              { k: 'pending', l: 'Pending' },
              { k: 'done', l: 'Done' },
              { k: 'missed', l: 'Missed' },
              { k: 'all', l: 'All' },
            ].map((opt) => (
              <button
                key={opt.k}
                type="button"
                onClick={() => setFilter(opt.k)}
                className={`px-3 py-1.5 text-xs font-medium transition ${
                  filter === opt.k
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} />
            Refresh
          </Button>
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading obligations…</p>
        ) : visibleItems.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Receipt size={28} className="text-slate-300" />
              <p className="text-sm font-medium text-slate-700">
                {selectedClientId
                  ? 'No obligations for this client under the current filter.'
                  : 'No obligations to show.'}
              </p>
              <p className="max-w-md text-xs text-slate-500">
                {selectedClientId ? (
                  <>
                    Try the <span className="font-semibold">All</span> tab, or
                    clear the client filter to see the full schedule.
                  </>
                ) : (
                  <>
                    Open a client&apos;s profile, set their entity type + GSTIN,
                    then click{' '}
                    <span className="font-semibold">Generate schedule</span>{' '}
                    to auto-create their upcoming filings. (UI for that is in v2
                    — today the generator is invoked via the backend service.)
                  </>
                )}
              </p>
            </div>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Due</th>
                  <th className="px-4 py-3 font-semibold">Filing</th>
                  <th className="px-4 py-3 font-semibold">Period</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleItems.map((it) => {
                  const isOverdue =
                    it.status === 'pending' && it.dueDate < today;
                  const client = clientById.get(it.clientUserId);
                  return (
                    <tr key={it.id} className="hover:bg-slate-50">
                      <td
                        className={`px-4 py-3 ${
                          isOverdue
                            ? 'font-semibold text-red-600'
                            : 'text-slate-700'
                        }`}
                      >
                        {formatDate(it.dueDate)}
                        {isOverdue && (
                          <span className="ml-1 text-[10px] uppercase tracking-wide">
                            overdue
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {it.ruleKey.toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {it.periodLabel}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {client ? (
                          <div>
                            <p className="font-medium text-slate-800">
                              {client.name || client.email || client.phone || it.clientUserId}
                            </p>
                            {client.phone || client.email ? (
                              <p className="text-[11px] text-slate-400">
                                {[client.phone, client.email]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="font-mono text-[11px] text-slate-500">
                            {it.clientUserId}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[it.status] || 'gray'}>
                          {STATUS_LABEL[it.status] || it.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {it.status === 'done' && it.attachmentStoragePath && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const out = await getObligationAttachmentUrl(it.id);
                                  if (out && out.url)
                                    window.open(out.url, '_blank', 'noopener,noreferrer');
                                } catch (err) {
                                  setError(err.message || 'Could not open file.');
                                }
                              }}
                              title={`Open attachment (${it.attachmentFileName || 'file'})`}
                              className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            >
                              📎
                            </button>
                          )}
                          {it.status !== 'done' && (
                            <button
                              type="button"
                              onClick={() => setDoneItem(it)}
                              disabled={busyId === it.id}
                              title="Mark done (add note + optional attachment)"
                              className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                          {it.status !== 'not_applicable' && (
                            <button
                              type="button"
                              onClick={() => setStatus(it, 'not_applicable')}
                              disabled={busyId === it.id}
                              title="Mark not applicable"
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteItem(it)}
                            disabled={busyId === it.id}
                            title="Remove from schedule (soft delete, requires reason)"
                            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MarkDoneModal
        item={doneItem}
        onClose={() => setDoneItem(null)}
        onDone={async () => {
          setDoneItem(null);
          await load();
        }}
      />

      <DeleteObligationModal
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onDone={async () => {
          setDeleteItem(null);
          await load();
        }}
      />
    </DashboardLayout>
  );
}

function DeleteObligationModal({ item, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (item) {
      setReason('');
      setError('');
    }
  }, [item]);

  async function submit() {
    if (!reason.trim()) {
      setError('A reason is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await softDeleteObligation(item.id, reason.trim());
      if (typeof onDone === 'function') await onDone();
    } catch (err) {
      setError(err.message || 'Could not delete.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={item ? `Remove "${item.ruleKey.toUpperCase()} — ${item.periodLabel}"` : 'Remove obligation'}
      size="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={busy || !reason.trim()}
            className="border-red-200 bg-red-600 text-white hover:bg-red-700"
          >
            {busy ? 'Removing…' : 'Remove'}
          </Button>
        </>
      }
    >
      {item && (
        <div className="space-y-3">
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This is a soft-delete — the obligation stays in the database
            with your reason captured so a future audit can trace it.
            It just disappears from the active schedule.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Reason for removing *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Filed under a different rule / client not registered for this any more / data entry error / etc."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

/**
 * MarkDoneModal — completion form for a compliance obligation.
 * Requires a non-empty note; lets the pro optionally attach a file
 * (challan / acknowledgement / etc.) which goes to S3 via the
 * existing storageService before the obligation is patched done.
 */
function MarkDoneModal({ item, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (item) {
      setNote('');
      setFile(null);
      setError('');
    }
  }, [item]);

  async function submit() {
    if (!note.trim()) {
      setError('Add a short note describing what was filed.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = { status: 'done', notes: note.trim() };
      if (file) {
        const up = await uploadObligationAttachment(item.id, file);
        if (up && up.storagePath) {
          payload.attachmentStoragePath = up.storagePath;
          payload.attachmentFileName = up.fileName || file.name;
        }
      }
      await updateObligation(item.id, payload);
      if (typeof onDone === 'function') await onDone();
    } catch (err) {
      setError(err.message || 'Could not mark done.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={item ? `Mark "${item.ruleKey.toUpperCase()} — ${item.periodLabel}" as done` : 'Mark done'}
      size="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={busy || !note.trim()}>
            {busy ? 'Saving…' : 'Mark done'}
          </Button>
        </>
      }
    >
      {item && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Filing note *
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="ARN / acknowledgement number, what was filed, any caveats…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Attachment <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="file"
              onChange={(e) => setFile((e.target.files && e.target.files[0]) || null)}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
              className="w-full text-xs"
            />
            {file && (
              <p className="mt-1 text-[11px] text-slate-500">
                {file.name} · {Math.round(file.size / 1024)} KB
              </p>
            )}
          </div>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

/**
 * ClientPicker — searchable dropdown for filtering the compliance
 * schedule to one client at a time. Type to filter, click to pick,
 * or hit the × in the selected pill to clear back to "all clients".
 *
 * Kept inline here because no other surface needs this exact shape;
 * if a second use shows up we can promote it to components/common/.
 */
function ClientPicker({ clients, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const selected = useMemo(
    () => (value ? clients.find((c) => c.id === value) || null : null),
    [clients, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.name, c.email, c.phone]
        .map((s) => String(s || '').toLowerCase())
        .some((s) => s.includes(q))
    );
  }, [clients, query]);

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1.5 block text-xs font-medium text-slate-600">
        Filter by client
      </label>
      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-800">
              {selected.name || selected.email || selected.phone || selected.id}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              Showing only this client&apos;s compliance schedule.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange('');
              setQuery('');
            }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800"
            title="Clear client filter"
          >
            <X size={11} />
            Clear
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={
              clients.length === 0
                ? 'No clients linked to you yet'
                : `Search ${clients.length} client${clients.length === 1 ? '' : 's'} by name, phone, or email…`
            }
            disabled={clients.length === 0}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50"
          />
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>
      )}

      {!selected && open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {filtered.slice(0, 50).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(c.id);
                  setQuery('');
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-blue-50"
              >
                <span className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {c.name || c.email || c.phone || c.id}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {[c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                  </p>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!selected && open && filtered.length === 0 && query.trim() && (
        <p className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-center text-xs text-slate-500 shadow-lg">
          No clients match &ldquo;{query}&rdquo;.
        </p>
      )}
    </div>
  );
}
