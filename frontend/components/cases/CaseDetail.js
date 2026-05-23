'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Briefcase,
  Pencil,
  RefreshCw,
  Send,
  ListChecks,
  MessageSquare,
} from 'lucide-react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Modal from '@/components/common/Modal';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import EmptyState from '@/components/common/EmptyState';
import caseService from '@/services/caseService';
import clientService from '@/services/clientService';
import { formatDate, formatDateTime } from '@/utils/formatters';

const PRIORITY_VARIANT = {
  low: 'gray',
  medium: 'gray',
  high: 'amber',
  urgent: 'red',
};

const STATUS_VARIANT = {
  open: 'blue',
  'in-progress': 'amber',
  closed: 'green',
};

const STATUS_LABEL = {
  open: 'Open',
  'in-progress': 'In progress',
  closed: 'Closed',
};

function DetailRow({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-700">{value || '—'}</dd>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

/**
 * CaseDetail — shared body for the professional and firm case detail pages.
 * Props: { caseId }
 */
export default function CaseDetail({ caseId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteError, setNoteError] = useState('');

  const [log, setLog] = useState([]);
  const [logLoading, setLogLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);

  const loadCase = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await caseService.getById(caseId);
      setData(res || null);
    } catch (err) {
      setError(err.message || 'Failed to load case.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  const loadNotes = useCallback(async () => {
    setNotesLoading(true);
    try {
      const res = await caseService.listNotes(caseId);
      setNotes(Array.isArray(res) ? res : []);
    } catch {
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  }, [caseId]);

  const loadLog = useCallback(async () => {
    setLogLoading(true);
    try {
      const res = await caseService.listLog(caseId);
      setLog(Array.isArray(res) ? res : []);
    } catch {
      setLog([]);
    } finally {
      setLogLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadCase();
    loadNotes();
    loadLog();
  }, [loadCase, loadNotes, loadLog]);

  async function submitNote(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (noteSubmitting) return;
    const body = noteBody.trim();
    if (!body) {
      setNoteError('Write something before posting a note.');
      return;
    }
    setNoteError('');
    setNoteSubmitting(true);
    try {
      await caseService.addNote(caseId, body);
      setNoteBody('');
      await Promise.all([loadNotes(), loadLog()]);
    } catch (err) {
      setNoteError(err.message || 'Could not add note.');
    } finally {
      setNoteSubmitting(false);
    }
  }

  if (loading) return <Skeleton />;

  if (error || !data) {
    return (
      <EmptyState
        icon={<Briefcase size={24} />}
        title="Case not found"
        description={error || 'This case may have been deleted or you do not have access.'}
        action={
          <Button size="sm" onClick={loadCase}>
            <RefreshCw size={15} />
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">
              {data.title || 'Untitled case'}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_VARIANT[data.status] || 'gray'}>
                {STATUS_LABEL[data.status] || data.status || 'Open'}
              </Badge>
              <Badge variant={PRIORITY_VARIANT[data.priority] || 'gray'}>
                {data.priority || 'medium'}
              </Badge>
              {data.category && (
                <Badge variant="gray">{data.category}</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadCase}
              disabled={loading}
            >
              <RefreshCw size={15} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setEditOpen(true)}>
              <Pencil size={15} />
              Edit
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: details */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-900">
            Case details
          </h3>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailRow label="Category" value={data.category} />
            <DetailRow
              label="Client"
              value={
                data.client
                  ? `${data.client.name}${
                      data.client.phone ? ` · ${data.client.phone}` : ''
                    }`
                  : data.clientId
              }
            />
            <DetailRow label="Court name" value={data.courtName} />
            <DetailRow label="Opposing party" value={data.opposingParty} />
            <DetailRow label="Case number" value={data.caseNumber} />
            <DetailRow
              label="Next hearing"
              value={data.nextHearingDate ? formatDate(data.nextHearingDate) : '—'}
            />
            <DetailRow
              label="Created"
              value={data.createdAt ? formatDate(data.createdAt) : '—'}
            />
            <DetailRow label="Assigned to" value={data.professionalId} />
          </dl>
          {data.description && (
            <div className="mt-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Description
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {data.description}
              </dd>
            </div>
          )}
        </Card>

        {/* Right: notes + activity log */}
        <div className="space-y-6">
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <MessageSquare size={16} className="text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">Notes</h3>
            </div>
            <form onSubmit={submitNote} className="space-y-2">
              <textarea
                rows={3}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Add a note for this case…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <div className="flex items-center justify-between gap-2">
                {noteError ? (
                  <p className="text-xs text-red-600">{noteError}</p>
                ) : (
                  <span />
                )}
                <Button
                  type="submit"
                  size="sm"
                  onClick={submitNote}
                  disabled={noteSubmitting || !noteBody.trim()}
                >
                  <Send size={14} />
                  {noteSubmitting ? 'Posting…' : 'Add note'}
                </Button>
              </div>
            </form>
            <div className="mt-4 space-y-3">
              {notesLoading ? (
                [0, 1].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-lg bg-slate-100"
                  />
                ))
              ) : notes.length === 0 ? (
                <p className="text-xs text-slate-500">No notes yet.</p>
              ) : (
                notes.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-700">
                        {n.authorName || n.actorName || 'Member'}
                      </p>
                      <span className="text-xs text-slate-400">
                        {formatDateTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {n.body}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <ListChecks size={16} className="text-amber-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Activity log
              </h3>
            </div>
            {logLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded-lg bg-slate-100"
                  />
                ))}
              </div>
            ) : log.length === 0 ? (
              <p className="text-xs text-slate-500">No activity recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {log.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700">
                        <Badge variant="gray" className="mr-2">
                          {entry.action || 'event'}
                        </Badge>
                        <span className="font-medium text-slate-800">
                          {entry.actorName || 'System'}
                        </span>
                        {entry.message && (
                          <span className="text-slate-600"> — {entry.message}</span>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatDate(entry.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Edit modal — reuses AddCaseModal's field set but calls update(). */}
      <EditCaseModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        caseData={data}
        onSaved={async () => {
          setEditOpen(false);
          await Promise.all([loadCase(), loadLog()]);
        }}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// EditCaseModal — uses the same field set as AddCaseModal but calls update().
// Kept inline to avoid an extra file.
// -----------------------------------------------------------------------------

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'closed', label: 'Closed' },
];

function formInitialFromCase(c) {
  return {
    clientId: c.clientId || '',
    title: c.title || '',
    category: c.category || '',
    description: c.description || '',
    priority: c.priority || 'medium',
    status: c.status || 'open',
    caseNumber: c.caseNumber || '',
    courtName: c.courtName || '',
    opposingParty: c.opposingParty || '',
    nextHearingDate: c.nextHearingDate
      ? String(c.nextHearingDate).slice(0, 10)
      : '',
    professionalId: c.professionalId || '',
  };
}

function EditCaseModal({ open, onClose, caseData, onSaved }) {
  const [form, setForm] = useState(() => formInitialFromCase(caseData || {}));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState([]);

  useEffect(() => {
    if (open && caseData) {
      setForm(formInitialFromCase(caseData));
      setError('');
      setSubmitting(false);
    }
  }, [open, caseData]);

  // Load the client list when the modal opens for the picker dropdown.
  useEffect(() => {
    if (!open) return;
    let active = true;
    clientService
      .getAll({ limit: 200 })
      .then((res) => {
        if (!active) return;
        const data = (res && res.data) || [];
        setClients(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setClients([]);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const clientOptions = [
    { value: '', label: '— Select a client —' },
    ...clients.map((c) => ({
      value: c.id,
      label: `${c.name || c.email || c.phone || c.id}${
        c.phone ? ` · ${c.phone}` : ''
      }`,
    })),
  ];

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function submit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (submitting || !caseData) return;
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!form.category.trim()) {
      setError('Category is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const changes = {
        clientId: form.clientId.trim() || null,
        title: form.title.trim(),
        category: form.category.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        status: form.status,
        caseNumber: form.caseNumber.trim() || null,
        courtName: form.courtName.trim() || null,
        opposingParty: form.opposingParty.trim() || null,
        nextHearingDate: form.nextHearingDate || null,
        professionalId: form.professionalId.trim() || null,
      };
      await caseService.update(caseData.id, changes);
      if (typeof onSaved === 'function') await onSaved();
    } catch (err) {
      setError(err.message || 'Could not save changes.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    if (typeof onClose === 'function') onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Edit case"
      size="lg"
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <Select
          label="Client"
          name="clientId"
          value={form.clientId}
          onChange={handleChange}
          options={clientOptions}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Title"
            name="title"
            value={form.title}
            onChange={handleChange}
            required
          />
          <Input
            label="Category"
            name="category"
            value={form.category}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label
            htmlFor="edit-case-description"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Description
          </label>
          <textarea
            id="edit-case-description"
            name="description"
            rows={3}
            value={form.description}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Priority"
            name="priority"
            value={form.priority}
            onChange={handleChange}
            options={PRIORITY_OPTIONS}
          />
          <Select
            label="Status"
            name="status"
            value={form.status}
            onChange={handleChange}
            options={STATUS_OPTIONS}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Case number"
            name="caseNumber"
            value={form.caseNumber}
            onChange={handleChange}
          />
          <Input
            label="Court name"
            name="courtName"
            value={form.courtName}
            onChange={handleChange}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Opposing party"
            name="opposingParty"
            value={form.opposingParty}
            onChange={handleChange}
          />
          <Input
            label="Next hearing date"
            name="nextHearingDate"
            type="date"
            value={form.nextHearingDate}
            onChange={handleChange}
          />
        </div>
        <Input
          label="Assigned professional"
          name="professionalId"
          value={form.professionalId}
          onChange={handleChange}
          placeholder="prof-N or pdetail-..."
        />
        <button type="submit" className="hidden" aria-hidden="true" />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
