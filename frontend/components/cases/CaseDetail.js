'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Briefcase,
  Pencil,
  RefreshCw,
  Send,
  ListChecks,
  MessageSquare,
  CalendarClock,
  Paperclip,
  Plus,
  X,
  Trash2,
  User as UserIcon,
  Phone,
  Mail,
  MapPin,
  Building2,
  Scale,
  CloudDownload,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Modal from '@/components/common/Modal';
import Input from '@/components/common/Input';
import EmptyState from '@/components/common/EmptyState';
import FileUpload from '@/components/common/FileUpload';
import AddCaseModal from '@/components/cases/AddCaseModal';
import { resolveFileUrl } from '@/services/fileService';
import CaseAttachmentLink from '@/components/cases/CaseAttachmentLink';
import CaseAttachmentList from '@/components/cases/CaseAttachmentList';
import caseService from '@/services/caseService';
import { getLawFirm } from '@/services/profileService';
import { syncCaseFromEcourts } from '@/services/ecourtsService';
import { useAuth } from '@/components/AuthProvider';
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

// Trim a multi-paragraph string to a max word count, preserving internal
// whitespace. Returns `{ truncated, didTruncate }` so the caller can decide
// whether to render a "Read more" affordance.
function truncateWords(text, max = 150) {
  if (!text || typeof text !== 'string') {
    return { truncated: '', didTruncate: false };
  }
  const tokens = text.match(/\S+|\s+/g) || [];
  let wordCount = 0;
  const kept = [];
  for (const tok of tokens) {
    if (/\S/.test(tok)) {
      if (wordCount >= max) break;
      wordCount += 1;
    }
    kept.push(tok);
  }
  const totalWords = (text.match(/\S+/g) || []).length;
  return {
    truncated: kept.join('').trimEnd(),
    didTruncate: totalWords > max,
  };
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
 * Props:
 *  - caseId            (required) the case to load
 *  - viewedAsFirmAdmin (optional) set by the /dashboard/firm/cases/[id]
 *    route. When true, the firm-case edit lock is bypassed — the viewer
 *    is acting as a firm admin and can edit firm cases / reassign pros.
 */
export default function CaseDetail({ caseId, viewedAsFirmAdmin = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Delete-case modal state.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingCase, setDeletingCase] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Firm members — loaded lazily; only populated when the caller belongs to
  // a firm. Used by the Edit modal so the assignee picker is available.
  const [firmMembers, setFirmMembers] = useState([]);

  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  // Attachments selected for the in-progress new-note form. Cleared on send.
  const [noteAttachments, setNoteAttachments] = useState([]);
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteError, setNoteError] = useState('');

  // Inline-edit state for a single note (id + draft body + draft attachments).
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteDraft, setEditingNoteDraft] = useState('');
  const [editingNoteAttachments, setEditingNoteAttachments] = useState([]);
  const [noteRowBusy, setNoteRowBusy] = useState(null);
  // Confirm-delete target for a note.
  const [deletingNoteId, setDeletingNoteId] = useState(null);

  const [log, setLog] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);

  // Update view/edit modal state.
  const [viewingUpdate, setViewingUpdate] = useState(null);

  // Full-description popup state.
  const [descriptionOpen, setDescriptionOpen] = useState(false);

  // Read-only role gating — clients can view + post/edit notes only.
  const isClient = user && user.role === 'client';
  // Individual professional = role 'professional' (firm admins use role
  // 'firm'). Used below to block firm-case edits + the assignee picker.
  // When the page is rendered under the firm dashboard route
  // (viewedAsFirmAdmin), the viewer is acting as a firm admin — bypass
  // the lock entirely, since legacy firm owners often have role
  // 'professional' too.
  const isIndividualPro =
    user && user.role === 'professional' && !viewedAsFirmAdmin;

  // Notes popup state — `viewingNote` shows one note's full content;
  // `allNotesOpen` shows every note in a scrollable list.
  const [viewingNote, setViewingNote] = useState(null);
  const [allNotesOpen, setAllNotesOpen] = useState(false);

  const [updates, setUpdates] = useState([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);

  // E-Courts India sync — modal showing what changed between the locally
  // stored snapshot and the live partner-API copy. `syncing` covers the
  // network call; `eciResult` carries { case, diff } on success.
  const [syncing, setSyncing] = useState(false);
  const [eciOpen, setEciOpen] = useState(false);
  const [eciResult, setEciResult] = useState(null);
  const [eciError, setEciError] = useState('');

  async function refreshFromEcourts() {
    if (syncing) return;
    setSyncing(true);
    setEciError('');
    setEciResult(null);
    setEciOpen(true);
    try {
      const res = await syncCaseFromEcourts(caseId);
      setEciResult(res);
      // Pull the fresh case data into the page so the field rows refresh.
      if (res && res.case) setData(res.case);
    } catch (err) {
      setEciError(err.message || 'Could not refresh from E-Courts.');
    } finally {
      setSyncing(false);
    }
  }

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

  const loadUpdates = useCallback(async () => {
    setUpdatesLoading(true);
    try {
      const res = await caseService.listUpdates(caseId);
      setUpdates(Array.isArray(res) ? res : []);
    } catch {
      setUpdates([]);
    } finally {
      setUpdatesLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadCase();
    loadNotes();
    loadLog();
    loadUpdates();
  }, [loadCase, loadNotes, loadLog, loadUpdates]);

  // Lazily load the caller's firm member list so the Edit-case modal can
  // render its assignee picker. Silently no-ops when the caller doesn't
  // belong to a firm. Runs once per mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const f = await getLawFirm();
        if (!active) return;
        const list = f && Array.isArray(f.members) ? f.members : [];
        setFirmMembers(list);
      } catch {
        if (active) setFirmMembers([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
      await caseService.addNote(caseId, { body, attachments: noteAttachments });
      setNoteBody('');
      setNoteAttachments([]);
      await Promise.all([loadNotes(), loadLog()]);
    } catch (err) {
      setNoteError(err.message || 'Could not add note.');
    } finally {
      setNoteSubmitting(false);
    }
  }

  function addNoteAttachment(url, meta) {
    if (!url) return;
    // Strip query params (signed URLs leak X-Amz-Signature etc) if we
    // ever have to fall back to deriving from the URL path.
    const cleanFromUrl = String(url).split('?')[0].split('/').pop();
    const name = (meta && meta.name) || cleanFromUrl;
    setNoteAttachments((prev) =>
      prev.some((a) => a.url === url) ? prev : [...prev, { url, name }]
    );
  }
  function removeNoteAttachment(url) {
    setNoteAttachments((prev) => prev.filter((a) => a.url !== url));
  }

  function startEditNote(note) {
    setEditingNoteId(note.id);
    setEditingNoteDraft(note.body || '');
    setEditingNoteAttachments(
      Array.isArray(note.attachments) ? note.attachments : []
    );
  }
  function cancelEditNote() {
    setEditingNoteId(null);
    setEditingNoteDraft('');
    setEditingNoteAttachments([]);
  }
  function addEditingNoteAttachment(url, meta) {
    if (!url) return;
    const cleanFromUrl = String(url).split('?')[0].split('/').pop();
    const name = (meta && meta.name) || cleanFromUrl;
    setEditingNoteAttachments((prev) =>
      prev.some((a) => a.url === url) ? prev : [...prev, { url, name }]
    );
  }
  function removeEditingNoteAttachment(url) {
    setEditingNoteAttachments((prev) => prev.filter((a) => a.url !== url));
  }
  async function saveEditNote(noteId) {
    const draft = editingNoteDraft.trim();
    if (!draft) return;
    setNoteRowBusy(noteId);
    try {
      await caseService.editNote(caseId, noteId, {
        body: draft,
        attachments: editingNoteAttachments,
      });
      setEditingNoteId(null);
      setEditingNoteDraft('');
      setEditingNoteAttachments([]);
      await Promise.all([loadNotes(), loadLog()]);
    } catch (err) {
      setNoteError(err.message || 'Could not edit note.');
    } finally {
      setNoteRowBusy(null);
    }
  }
  async function confirmDeleteNote() {
    if (!deletingNoteId) return;
    setNoteRowBusy(deletingNoteId);
    try {
      await caseService.deleteNote(caseId, deletingNoteId);
      setDeletingNoteId(null);
      await Promise.all([loadNotes(), loadLog()]);
    } catch (err) {
      setNoteError(err.message || 'Could not delete note.');
    } finally {
      setNoteRowBusy(null);
    }
  }

  function openDeleteCase() {
    setDeleteConfirmText('');
    setDeleteError('');
    setDeleteOpen(true);
  }
  function closeDeleteCase() {
    if (deletingCase) return;
    setDeleteOpen(false);
    setDeleteConfirmText('');
    setDeleteError('');
  }
  async function confirmDeleteCase() {
    if (deletingCase) return;
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') {
      setDeleteError('Type "delete" to confirm.');
      return;
    }
    setDeletingCase(true);
    setDeleteError('');
    try {
      await caseService.remove(caseId);
      // Send the user back to the listing they came from.
      router.back();
    } catch (err) {
      setDeleteError(err.message || 'Could not delete the case.');
      setDeletingCase(false);
    }
  }

  if (loading) return <Skeleton />;

  if (error || !data) {
    return (
      <EmptyState
        icon={<Briefcase size={24} />}
        title="Case not found"
        description={
          error || 'This case may have been deleted or you do not have access.'
        }
        action={
          <Button size="sm" onClick={loadCase}>
            <RefreshCw size={15} />
            Try again
          </Button>
        }
      />
    );
  }

  const clients =
    Array.isArray(data.clients) && data.clients.length > 0
      ? data.clients
      : data.client
        ? [data.client]
        : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">
                {data.title || 'Untitled case'}
              </h2>
              {/* Firm-case tag — surfaced inline with the title so the
                  pro can immediately tell this case rolls up to the
                  firm's quota, not theirs. Same rule as the listing
                  badge: 2+ assignees. */}
              {Array.isArray(data.professionalIds) &&
                data.professionalIds.filter(Boolean).length >= 2 && (
                  <span
                    title={`Firm case — ${data.professionalIds.filter(Boolean).length} professionals assigned`}
                    className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700"
                  >
                    <Building2 size={10} />
                    Firm case
                  </span>
                )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_VARIANT[data.status] || 'gray'}>
                {STATUS_LABEL[data.status] || data.status || 'Open'}
              </Badge>
              <Badge variant={PRIORITY_VARIANT[data.priority] || 'gray'}>
                {data.priority || 'medium'}
              </Badge>
              {data.category && <Badge variant="gray">{data.category}</Badge>}
              {data.cnr && (
                <span
                  title="E-Courts India CNR"
                  className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-inset ring-amber-200"
                >
                  <Scale size={10} />
                  CNR
                  <span className="font-mono">{data.cnr}</span>
                </span>
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
            {data && data.source === 'ecourts' && data.cnr ? (
              <Button
                variant="primary"
                size="sm"
                href={`/ecourts/${encodeURIComponent(data.cnr)}?from=${encodeURIComponent(pathname || '')}`}
                title="Open the live E-Courts India record for this case"
              >
                <CloudDownload size={15} />
                Update from E-Court
              </Button>
            ) : null}
            {!isClient && (() => {
              // A firm case (2+ assignees) is owned by the firm, not any
              // individual member — only the firm admin can edit it.
              // Individual pros see the button disabled with an
              // explanatory tooltip.
              const assignees = Array.isArray(data && data.professionalIds)
                ? data.professionalIds.filter(Boolean)
                : [];
              const isFirmCase = assignees.length >= 2;
              const editLocked = isIndividualPro && isFirmCase;
              return (
                <Button
                  size="sm"
                  onClick={() => setEditOpen(true)}
                  disabled={editLocked}
                  title={
                    editLocked
                      ? 'This is a firm case — only the firm admin can edit it.'
                      : undefined
                  }
                >
                  <Pencil size={15} />
                  Edit
                </Button>
              );
            })()}
          </div>
        </div>
      </Card>

      {/* Client panel — always on top of the detail view */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <UserIcon size={16} className="text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            {clients.length > 1 ? `Clients (${clients.length})` : 'Client'}
          </h3>
        </div>
        {clients.length === 0 ? (
          <p className="text-xs text-slate-500">
            No clients linked to this case.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {clients.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
              >
                <p className="text-sm font-semibold text-slate-800">
                  {c.name || c.email || c.phone || c.id}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  {c.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={12} className="text-slate-400" />
                      {c.phone}
                    </span>
                  )}
                  {c.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail size={12} className="text-slate-400" />
                      {c.email}
                    </span>
                  )}
                  {c.city && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} className="text-slate-400" />
                      {c.city}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: details */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-900">
            Case details
          </h3>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailRow label="Category" value={data.category} />
            <DetailRow label="Court name" value={data.courtName} />
            <DetailRow label="Opposing party" value={data.opposingParty} />
            <DetailRow label="Case number" value={data.caseNumber} />
            <DetailRow
              label="Next hearing"
              value={
                data.nextHearingDate ? formatDate(data.nextHearingDate) : '—'
              }
            />
            <DetailRow
              label="Created"
              value={data.createdAt ? formatDate(data.createdAt) : '—'}
            />
            <DetailRow
              label="Assigned to"
              value={(() => {
                const list =
                  Array.isArray(data.professionals) &&
                  data.professionals.length > 0
                    ? data.professionals
                    : data.professional
                      ? [data.professional]
                      : data.professionalId
                        ? [{ publicId: data.professionalId, name: data.professionalId }]
                        : [];
                if (list.length === 0) return '—';
                return (
                  <span className="flex flex-wrap gap-1.5">
                    {list.map((p) => (
                      <a
                        key={p.publicId}
                        href={`/professionals/${p.publicId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        {p.name || p.publicId}
                      </a>
                    ))}
                  </span>
                );
              })()}
            />
          </dl>
          {data.description && (() => {
            const { truncated, didTruncate } = truncateWords(
              data.description,
              150
            );
            return (
              <div className="mt-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Description
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {truncated}
                  {didTruncate && '…'}
                </dd>
                {didTruncate && (
                  <button
                    type="button"
                    onClick={() => setDescriptionOpen(true)}
                    className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Read more
                  </button>
                )}
              </div>
            );
          })()}
        </Card>

        {/* Right: notes + activity log */}
        <div className="space-y-6">
          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Notes / Messages
                </h3>
                {notes.length > 0 && (
                  <span className="text-xs text-slate-400">({notes.length})</span>
                )}
              </div>
              {notes.length > 2 && (
                <button
                  type="button"
                  onClick={() => setAllNotesOpen(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  View all
                </button>
              )}
            </div>
            <form onSubmit={submitNote} className="space-y-2">
              <textarea
                rows={3}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Add a note / message for this case…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {/* Attachments uploader — any stakeholder can attach docs/pics.
                  category=case_note + caseId scopes the S3 object under
                  `case-files/<caseId>/`, isolated per case. */}
              <FileUpload
                value=""
                onChange={(url, meta) => addNoteAttachment(url, meta)}
                category="case_note"
                caseId={caseId}
                accept=".pdf,.doc,.docx,image/*"
              />
              {noteAttachments.length > 0 && (
                <ul className="space-y-1.5">
                  {noteAttachments.map((a) => (
                    <li
                      key={a.url}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs"
                    >
                      <span className="flex items-center gap-1.5 truncate text-slate-600">
                        <Paperclip size={11} className="text-slate-400" />
                        {a.name || a.url}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeNoteAttachment(a.url)}
                        className="text-slate-400 hover:text-red-600"
                        aria-label="Remove attachment"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
                // Widget shows only the 2 newest notes (the list is already
                // sorted DESC by createdAt server-side). Anything longer is
                // accessible via the "View all" header link or the per-note
                // Read more link.
                notes.slice(0, 2).map((n) => {
                  const isEditing = editingNoteId === n.id;
                  const busy = noteRowBusy === n.id;
                  const { truncated, didTruncate } = truncateWords(n.body, 30);
                  return (
                    <div
                      key={n.id}
                      className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-700">
                          {n.authorName || n.actorName || 'Member'}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">
                            {formatDateTime(n.createdAt)}
                          </span>
                          {!isEditing && !isClient && (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditNote(n)}
                                className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                                aria-label="Edit note"
                                disabled={busy}
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingNoteId(n.id)}
                                className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                aria-label="Delete note"
                                disabled={busy}
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {isEditing ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            rows={3}
                            value={editingNoteDraft}
                            onChange={(e) =>
                              setEditingNoteDraft(e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          />
                          <FileUpload
                            value=""
                            onChange={(url, meta) =>
                              addEditingNoteAttachment(url, meta)
                            }
                            category="case_note"
                            caseId={caseId}
                            accept=".pdf,.doc,.docx,image/*"
                          />
                          {editingNoteAttachments.length > 0 && (
                            <ul className="space-y-1.5">
                              {editingNoteAttachments.map((a) => (
                                <li
                                  key={a.url}
                                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                >
                                  <span className="flex items-center gap-1.5 truncate text-slate-600">
                                    <Paperclip size={11} className="text-slate-400" />
                                    {a.name || a.url}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeEditingNoteAttachment(a.url)
                                    }
                                    className="text-slate-400 hover:text-red-600"
                                    aria-label="Remove attachment"
                                  >
                                    <X size={12} />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={cancelEditNote}
                              disabled={busy}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => saveEditNote(n.id)}
                              disabled={busy || !editingNoteDraft.trim()}
                            >
                              {busy ? 'Saving…' : 'Save'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                            {truncated}
                            {didTruncate && '…'}
                          </p>
                          <CaseAttachmentList
                            caseId={caseId}
                            attachments={n.attachments}
                          />
                          {didTruncate && (
                            <button
                              type="button"
                              onClick={() => setViewingNote(n)}
                              className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                            >
                              Read more
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ListChecks size={16} className="text-amber-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Activity log
                </h3>
                {log.length > 0 && (
                  <span className="text-xs text-slate-400">({log.length})</span>
                )}
              </div>
              {log.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLogModalOpen(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  See all
                </button>
              )}
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
              <p className="text-xs text-slate-500">
                No activity recorded yet.
              </p>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
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
                          <span className="text-slate-600">
                            {' '}
                            — {entry.message}
                          </span>
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

      {/* Updates — full-width timeline */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarClock size={16} className="text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-900">Updates</h3>
            <span className="text-xs text-slate-500">
              Timestamped progress entries with attachments.
            </span>
          </div>
          {!isClient && (
            <Button size="sm" onClick={() => setUpdateOpen(true)}>
              <Plus size={14} />
              Add update
            </Button>
          )}
        </div>
        {updatesLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </div>
        ) : updates.length === 0 ? (
          <p className="text-xs text-slate-500">
            No updates yet — add the first one to start the timeline.
          </p>
        ) : (
          <ol className="space-y-3">
            {updates.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setViewingUpdate(u)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      {u.title && (
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {u.title}
                        </p>
                      )}
                      <p className="text-xs">
                        <span className="font-semibold text-slate-700">
                          {u.authorName || 'Professional'}
                        </span>
                        <span className="text-slate-500">
                          {' · '}
                          {formatDateTime(u.scheduledAt || u.createdAt)}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {u.nextHearingDate && (
                        <Badge variant="amber">
                          Next hearing {formatDate(u.nextHearingDate)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {u.body && (
                    <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-slate-700">
                      {u.body}
                    </p>
                  )}
                </button>
                {/* Attachments rendered OUTSIDE the button so each link
                    is its own actionable element (a <a> inside <button>
                    is invalid HTML and the click would bubble). Images
                    appear as thumbnails; PDFs/DOCs as paperclip pills.
                    All open in a new tab via CaseAttachmentLink. */}
                <div className="mt-1 px-3 pb-3">
                  <CaseAttachmentList
                    caseId={caseId}
                    attachments={u.attachments}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* Danger zone — case deletion lives at the very bottom of the page
          so it stays out of the way until you explicitly scroll to it.
          Clients can only delete their own cases when no professional has
          been assigned yet (server-enforced as well). */}
      {(() => {
        const assignees = Array.isArray(data && data.professionalIds)
          ? data.professionalIds.filter(Boolean)
          : [];
        const hasPro = !!(data && data.professionalId) || assignees.length > 0;
        const canDelete = isClient ? !hasPro : true;
        if (isClient && hasPro) return null;
        return (
          <Card className="border-red-200">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-red-700">Danger zone</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {isClient
                    ? 'Deleting this case removes every note and update you added. No professional is assigned yet, so this can be done from your side. This cannot be undone.'
                    : 'Deleting the case removes every note, update, attachment, and activity-log entry. This cannot be undone.'}
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={openDeleteCase}
                disabled={!canDelete}
              >
                <Trash2 size={14} />
                Delete case
              </Button>
            </div>
          </Card>
        );
      })()}

      {/* Full-description popup */}
      <Modal
        open={descriptionOpen}
        onClose={() => setDescriptionOpen(false)}
        title={data.title ? `Description — ${data.title}` : 'Description'}
        size="lg"
        footer={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDescriptionOpen(false)}
          >
            Close
          </Button>
        }
      >
        <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm text-slate-700">
          {data.description}
        </div>
      </Modal>

      {/* Single-note popup (from "Read more" on a truncated note) */}
      <Modal
        open={!!viewingNote}
        onClose={() => setViewingNote(null)}
        title="Note"
        size="md"
        footer={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewingNote(null)}
          >
            Close
          </Button>
        }
      >
        {viewingNote && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-800">
                {viewingNote.authorName ||
                  viewingNote.actorName ||
                  'Member'}
              </span>
              <span className="text-slate-400">
                {formatDateTime(viewingNote.createdAt)}
              </span>
            </div>
            <p className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm text-slate-700">
              {viewingNote.body}
            </p>
            {Array.isArray(viewingNote.attachments) &&
              viewingNote.attachments.length > 0 && (
                <div>
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Attachments
                  </h4>
                  <CaseAttachmentList
                    caseId={caseId}
                    attachments={viewingNote.attachments}
                  />
                </div>
              )}
          </div>
        )}
      </Modal>

      {/* All-notes popup (from "View all" in the header) */}
      <Modal
        open={allNotesOpen}
        onClose={() => setAllNotesOpen(false)}
        title={`All notes (${notes.length})`}
        size="lg"
        footer={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAllNotesOpen(false)}
          >
            Close
          </Button>
        }
      >
        {notes.length === 0 ? (
          <p className="text-sm text-slate-500">No notes yet.</p>
        ) : (
          <ul className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {notes.map((n) => (
              <li
                key={n.id}
                className="rounded-lg border border-slate-100 bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">
                    {n.authorName || n.actorName || 'Member'}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatDateTime(n.createdAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {n.body}
                </p>
                <CaseAttachmentList
                  caseId={caseId}
                  attachments={n.attachments}
                />
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* Edit-case modal (multi-client, full form) */}
      <AddCaseModal
        open={editOpen}
        mode="edit"
        defaults={{
          id: data.id,
          clientIds: data.clientIds && data.clientIds.length > 0
            ? data.clientIds
            : data.clientId
              ? [data.clientId]
              : [],
          // Snapshot of the case's clients keyed by id. Used by the modal
          // as a fallback so chips render with the right name even when a
          // client isn't part of the pro's loaded clients list (e.g. a
          // booking-converted case where no ProfessionalClient link
          // existed at convert time).
          clientsSnapshot: Array.isArray(data.clients) ? data.clients : [],
          title: data.title,
          category: data.category,
          description: data.description,
          priority: data.priority,
          caseNumber: data.caseNumber,
          courtName: data.courtName,
          opposingParty: data.opposingParty,
          nextHearingDate: data.nextHearingDate
            ? String(data.nextHearingDate).slice(0, 10)
            : '',
          professionalIds:
            Array.isArray(data.professionalIds) && data.professionalIds.length > 0
              ? data.professionalIds
              : data.professionalId
                ? [data.professionalId]
                : [],
          firmId: data.firmId || undefined,
        }}
        onClose={() => setEditOpen(false)}
        onUpdated={async () => {
          setEditOpen(false);
          await Promise.all([loadCase(), loadLog()]);
        }}
        firmMembers={firmMembers}
        // Individual pros can't change the assignee list — adding a second
        // pro would turn this into a firm case which only the firm admin
        // is allowed to create/edit.
        lockAssignees={isIndividualPro}
      />

      {/* Add-update modal */}
      <AddUpdateModal
        open={updateOpen}
        caseId={caseId}
        onClose={() => setUpdateOpen(false)}
        onAdded={async () => {
          setUpdateOpen(false);
          await Promise.all([loadUpdates(), loadCase(), loadLog()]);
        }}
        authorDisplayName={authorDisplayNameFromAuth(user)}
      />

      {/* Activity log "See all" popup */}
      <Modal
        open={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        title="Activity log"
        size="lg"
        footer={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLogModalOpen(false)}
          >
            Close
          </Button>
        }
      >
        {log.length === 0 ? (
          <p className="text-sm text-slate-500">No activity recorded yet.</p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {log.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Badge variant="gray" className="mr-2">
                      {entry.action || 'event'}
                    </Badge>
                    <span className="font-medium text-slate-800">
                      {entry.actorName || 'System'}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
                {entry.message && (
                  <p className="mt-1 text-sm text-slate-700">{entry.message}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* View/edit/delete a single update */}
      <UpdateViewModal
        open={!!viewingUpdate}
        update={viewingUpdate}
        caseId={caseId}
        readOnly={isClient}
        onClose={() => setViewingUpdate(null)}
        onSaved={async () => {
          setViewingUpdate(null);
          await Promise.all([loadUpdates(), loadCase(), loadLog()]);
        }}
        onDeleted={async () => {
          setViewingUpdate(null);
          await Promise.all([loadUpdates(), loadCase(), loadLog()]);
        }}
      />

      {/* Confirm case deletion — requires typing "delete" to enable. */}
      <Modal
        open={deleteOpen}
        onClose={closeDeleteCase}
        title="Delete case"
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={closeDeleteCase}
              disabled={deletingCase}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmDeleteCase}
              disabled={
                deletingCase ||
                deleteConfirmText.trim().toLowerCase() !== 'delete'
              }
            >
              {deletingCase ? 'Deleting…' : 'Delete case permanently'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-semibold">
              This permanently deletes <span className="underline">
                {data.title || 'this case'}
              </span>.
            </p>
            <p className="mt-1 text-xs">
              Every note, update, attachment, and activity-log entry for the
              case will be removed. This cannot be undone.
            </p>
          </div>
          <div>
            <label
              htmlFor="confirm-delete-text"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Type <span className="font-mono text-red-600">delete</span> to
              confirm
            </label>
            <input
              id="confirm-delete-text"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="delete"
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>
          {deleteError && (
            <p className="text-xs text-red-600">{deleteError}</p>
          )}
        </div>
      </Modal>

      {/* Confirm note deletion */}
      <Modal
        open={!!deletingNoteId}
        onClose={() => setDeletingNoteId(null)}
        title="Delete note"
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeletingNoteId(null)}
              disabled={!!noteRowBusy}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmDeleteNote}
              disabled={!!noteRowBusy}
            >
              {noteRowBusy ? 'Deleting…' : 'Delete note'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Delete this note? This can&apos;t be undone — the activity log will
          record the deletion.
        </p>
      </Modal>

      {/* E-Courts India sync modal — shows what changed since last refresh */}
      <Modal
        open={eciOpen}
        onClose={() => setEciOpen(false)}
        title="Update from E-Courts India"
        size="lg"
        footer={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setEciOpen(false)}
            disabled={syncing}
          >
            Done
          </Button>
        }
      >
        {syncing ? (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
            <Loader2 size={18} className="animate-spin text-amber-600" />
            <div>
              <p className="font-semibold text-slate-800">
                Fetching the latest record…
              </p>
              <p className="text-xs text-slate-500">
                E-Courts can take 10–60 seconds to respond. Please don&apos;t
                close this window.
              </p>
            </div>
          </div>
        ) : eciError ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{eciError}</span>
          </div>
        ) : eciResult ? (
          <EcourtsDiffBody result={eciResult} />
        ) : null}
      </Modal>
    </div>
  );
}

// EcourtsDiffBody — renders the full latest snapshot from E-Courts plus
// a "what changed since last sync" banner. The diff payload is computed
// server-side so users see deltas at a glance, but the bulk of the modal
// shows the complete current state (parties, hearings, orders, judgments)
// — that's what a returning user actually wants to scan.
function EcourtsDiffBody({ result }) {
  const c = (result && result.case) || {};
  const snap = c.eciSnapshot || {};
  const diff = (result && result.diff) || {};
  const newKeys = new Set(
    (diff.newHearings || []).map(
      (h) =>
        `${h.hearingDate || h.businessOnDate || ''}|${h.purposeOfListing || h.purpose || ''}`
    )
  );
  const newOrderKeys = new Set(
    (diff.newOrders || []).map(
      (o) => `${o.orderDate || ''}|${o.orderUrl || o.filename || ''}`
    )
  );
  const interim = Array.isArray(snap.interimOrders) ? snap.interimOrders : [];
  const judgments = Array.isArray(snap.judgmentOrders)
    ? snap.judgmentOrders
    : [];
  const hearings = Array.isArray(snap.historyOfCaseHearings)
    ? snap.historyOfCaseHearings
    : [];

  const apiBase =
    typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL
      : '';

  return (
    <div className="space-y-5">
      {/* Summary banner — diff-aware. */}
      {diff.isFirstSync ? (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>
            First refresh saved. Future syncs will mark only what&apos;s new.
          </span>
        </div>
      ) : diff.hasAnyChange ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <RefreshCw size={16} className="mt-0.5 shrink-0" />
          <span>
            {(diff.fieldChanges || []).length} field change(s),{' '}
            {(diff.newHearings || []).length} new hearing(s),{' '}
            {(diff.newOrders || []).length} new order(s) since the last
            refresh — highlighted below.
          </span>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          <span>
            No new updates from E-Courts India since the last refresh — full
            current record below.
          </span>
        </div>
      )}

      {/* Field changes (only when something changed) */}
      {(diff.fieldChanges || []).length > 0 ? (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            What changed
          </h4>
          <ul className="mt-2 space-y-2">
            {diff.fieldChanges.map((ch, i) => (
              <li
                key={`${ch.field}-${i}`}
                className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm"
              >
                <p className="text-xs font-semibold text-amber-800">
                  {ch.field}
                </p>
                <p className="mt-1 text-slate-700">
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-mono text-red-700 line-through">
                    {String(ch.from || '—')}
                  </span>{' '}
                  <span className="mx-1 text-slate-400">→</span>{' '}
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-mono text-emerald-700">
                    {String(ch.to || '—')}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Case summary grid */}
      <section>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Case summary
        </h4>
        <div className="mt-2 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3">
          <KV label="CNR" value={c.cnr} mono />
          <KV label="Status" value={snap.caseStatus || '—'} />
          <KV label="Case type" value={snap.caseType || c.caseType || '—'} />
          <KV
            label="Case number"
            value={snap.caseNumber || c.caseNumber || '—'}
          />
          <KV
            label="Court"
            value={snap.courtName || snap.courtCode || c.courtName || '—'}
          />
          <KV
            label="District / State"
            value={
              [snap.district || c.district, snap.state || c.state]
                .filter(Boolean)
                .join(', ') || '—'
            }
          />
          <KV label="Filed on" value={formatDate(snap.filingDate || c.filingDate)} />
          <KV
            label="Registered on"
            value={formatDate(snap.registrationDate)}
          />
          <KV
            label="Decision date"
            value={formatDate(snap.decisionDate || c.decisionDate)}
          />
          <KV
            label="Next hearing"
            value={formatDate(snap.nextHearingDate || c.nextHearingDate)}
          />
          <KV
            label="Refreshed"
            value={
              c.eciSyncedAt
                ? formatDateTime(c.eciSyncedAt)
                : 'just now'
            }
          />
        </div>
      </section>

      {/* Parties */}
      <section>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Parties &amp; counsel
        </h4>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PartyList
            label="Petitioner(s)"
            items={snap.petitioners || c.petitioners}
          />
          <PartyList
            label="Respondent(s)"
            items={snap.respondents || c.respondents}
          />
          <PartyList
            label="Petitioner's advocates"
            items={snap.petitionerAdvocates || c.petitionerAdvocates}
          />
          <PartyList
            label="Respondent's advocates"
            items={snap.respondentAdvocates || c.respondentAdvocates}
          />
          <PartyList label="Judges" items={snap.judges || c.judges} />
        </div>
      </section>

      {/* Acts & sections */}
      {Array.isArray(snap.actsAndSections) && snap.actsAndSections.length > 0 ? (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Acts &amp; sections
          </h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {snap.actsAndSections.map((a, i) => (
              <span
                key={`${a}-${i}`}
                className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700"
              >
                {a}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {/* Hearings */}
      {hearings.length > 0 ? (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Hearing history ({hearings.length})
          </h4>
          <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
            {hearings.map((h, i) => {
              const k = `${h.hearingDate || h.businessOnDate || ''}|${h.purposeOfListing || h.purpose || ''}`;
              const isNew = newKeys.has(k);
              return (
                <li
                  key={i}
                  className={`rounded-lg border p-3 text-sm ${
                    isNew
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold text-slate-900">
                      {formatDate(h.hearingDate || h.businessOnDate) || '—'}
                    </p>
                    {isNew ? (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                        New
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {h.purposeOfListing || h.purpose || '—'}
                  </p>
                  {h.judge ? (
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Before {h.judge}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Orders & judgments */}
      {interim.length + judgments.length > 0 ? (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Orders &amp; judgments ({interim.length + judgments.length})
          </h4>
          <ul className="mt-2 space-y-2">
            {judgments.map((o, i) => (
              <OrderListItem
                key={`j-${o.orderUrl}-${i}`}
                order={o}
                cnr={c.cnr}
                isNew={newOrderKeys.has(
                  `${o.orderDate || ''}|${o.orderUrl || o.filename || ''}`
                )}
                kind="Judgment"
                apiBase={apiBase}
              />
            ))}
            {interim.map((o, i) => (
              <OrderListItem
                key={`i-${o.orderUrl}-${i}`}
                order={o}
                cnr={c.cnr}
                isNew={newOrderKeys.has(
                  `${o.orderDate || ''}|${o.orderUrl || o.filename || ''}`
                )}
                kind="Order"
                apiBase={apiBase}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function KV({ label, value, mono }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm font-semibold text-slate-800 ${mono ? 'font-mono text-[12px] uppercase tracking-wide' : ''}`}
      >
        {value || '—'}
      </p>
    </div>
  );
}

function PartyList({ label, items }) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      {list.length === 0 ? (
        <p className="mt-1 text-sm text-slate-400">Not listed</p>
      ) : (
        <ul className="mt-1 space-y-0.5 text-sm text-slate-800">
          {list.map((name, i) => (
            <li key={`${name}-${i}`}>{name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderListItem({ order, cnr, isNew, kind, apiBase }) {
  const fname = order.orderUrl || order.filename;
  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm ${
        isNew ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="font-semibold text-slate-900">
            {order.orderType || order.description || kind}
          </p>
          {isNew ? (
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
              New
            </span>
          ) : null}
        </div>
        <p className="text-xs text-slate-500">
          {formatDate(order.orderDate)}
          {fname ? (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-slate-400">
              {fname}
            </span>
          ) : null}
        </p>
      </div>
      {cnr && fname ? (
        <a
          href={`${apiBase}/api/ecourts/case/${encodeURIComponent(cnr)}/order/${encodeURIComponent(fname)}/download`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
        >
          <Scale size={12} />
          Download
        </a>
      ) : null}
    </li>
  );
}

// Helper: derive a display name from the JWT-shaped user object. The
// payload doesn't carry name fields, so this falls back to email-local.
function authorDisplayNameFromAuth(u) {
  if (!u) return '';
  if (u.fullName) return u.fullName;
  if (u.firstName || u.lastName) {
    return [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  }
  if (u.name) return u.name;
  if (u.email) return String(u.email).split('@')[0];
  return '';
}

// -----------------------------------------------------------------------------
// AddUpdateModal — date/time + body + next-hearing date + multi-attachment.
// -----------------------------------------------------------------------------

function nowLocalDatetime() {
  const d = new Date();
  // YYYY-MM-DDTHH:mm in local time for the <input type="datetime-local"> field.
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AddUpdateModal({ open, caseId, onClose, onAdded, authorDisplayName }) {
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() => nowLocalDatetime());
  const [body, setBody] = useState('');
  const [nextHearingDate, setNextHearingDate] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTitle('');
      setScheduledAt(nowLocalDatetime());
      setBody('');
      setNextHearingDate('');
      setAttachments([]);
      setSubmitting(false);
      setError('');
    }
  }, [open]);

  function addAttachment(url, meta) {
    if (!url) return;
    const cleanFromUrl = String(url).split('?')[0].split('/').pop();
    const name = (meta && meta.name) || cleanFromUrl;
    setAttachments((prev) =>
      prev.some((a) => a.url === url) ? prev : [...prev, { url, name }]
    );
  }
  function removeAttachment(url) {
    setAttachments((prev) => prev.filter((a) => a.url !== url));
  }

  async function submit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (submitting) return;
    if (!body.trim()) {
      setError('Write something for the update.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await caseService.addUpdate(caseId, {
        title: title.trim() || undefined,
        body: body.trim(),
        scheduledAt: scheduledAt
          ? new Date(scheduledAt).toISOString()
          : undefined,
        nextHearingDate: nextHearingDate || undefined,
        attachments,
      });
      if (typeof onAdded === 'function') await onAdded();
    } catch (err) {
      setError(err.message || 'Could not save the update.');
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
      title="Add update"
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
            disabled={submitting || !body.trim()}
          >
            {submitting ? 'Saving…' : 'Save update'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        {authorDisplayName && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <UserIcon size={13} className="shrink-0" />
            Adding as <span className="font-semibold">{authorDisplayName}</span>
          </div>
        )}
        <Input
          label="Title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Hearing #2 — discovery exchanged"
          hint="Optional — a short headline for the timeline."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Date & time of update"
            name="scheduledAt"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            hint="Defaults to now."
          />
          <Input
            label="Next hearing date"
            name="nextHearingDate"
            type="date"
            value={nextHearingDate}
            onChange={(e) => setNextHearingDate(e.target.value)}
            hint="Saved to the case + the audit log."
          />
        </div>
        <div>
          <label
            htmlFor="update-body"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            What happened?
          </label>
          <textarea
            id="update-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Describe the update, the hearing outcome, next steps…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Attachments
          </label>
          <FileUpload
            value=""
            onChange={(url, meta) => addAttachment(url, meta)}
            category="case_note"
            caseId={caseId}
            accept=".pdf,.doc,.docx,image/*"
          />
          {attachments.length > 0 && (
            <ul className="mt-3 space-y-2">
              {attachments.map((a) => (
                <li
                  key={a.url}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                >
                  <span className="flex items-center gap-2 truncate text-slate-600">
                    <Paperclip size={12} className="text-slate-400" />
                    {a.name || a.url}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.url)}
                    className="text-slate-400 hover:text-red-600"
                    aria-label="Remove attachment"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit" className="hidden" aria-hidden="true" />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// UpdateViewModal — read-only view of a single update, with an "Edit"
// toggle that swaps the body to the editable form (title + datetime + body
// + next hearing + attachments).
// -----------------------------------------------------------------------------

function UpdateViewModal({
  open,
  update,
  caseId,
  onClose,
  onSaved,
  onDeleted,
  readOnly = false,
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [body, setBody] = useState('');
  const [nextHearingDate, setNextHearingDate] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset form whenever the update being viewed changes.
  useEffect(() => {
    if (!open || !update) return;
    setEditing(false);
    setTitle(update.title || '');
    setScheduledAt(
      update.scheduledAt
        ? // Convert ISO → local datetime-local input value.
          (() => {
            const d = new Date(update.scheduledAt);
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          })()
        : ''
    );
    setBody(update.body || '');
    setNextHearingDate(
      update.nextHearingDate
        ? String(update.nextHearingDate).slice(0, 10)
        : ''
    );
    setAttachments(Array.isArray(update.attachments) ? update.attachments : []);
    setSaving(false);
    setError('');
    setConfirmDelete(false);
    setDeleting(false);
  }, [open, update]);

  function addAttachment(url, meta) {
    if (!url) return;
    const cleanFromUrl = String(url).split('?')[0].split('/').pop();
    const name = (meta && meta.name) || cleanFromUrl;
    setAttachments((prev) =>
      prev.some((a) => a.url === url) ? prev : [...prev, { url, name }]
    );
  }
  function removeAttachment(url) {
    setAttachments((prev) => prev.filter((a) => a.url !== url));
  }

  async function save() {
    if (saving || !update) return;
    if (!body.trim()) {
      setError('Body is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await caseService.editUpdate(caseId, update.id, {
        title: title.trim() || null,
        body: body.trim(),
        scheduledAt: scheduledAt
          ? new Date(scheduledAt).toISOString()
          : undefined,
        nextHearingDate: nextHearingDate || null,
        attachments,
      });
      if (typeof onSaved === 'function') await onSaved();
    } catch (err) {
      setError(err.message || 'Could not save the update.');
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (deleting || !update) return;
    setDeleting(true);
    setError('');
    try {
      await caseService.deleteUpdate(caseId, update.id);
      if (typeof onDeleted === 'function') await onDeleted();
    } catch (err) {
      setError(err.message || 'Could not delete the update.');
    } finally {
      setDeleting(false);
    }
  }

  if (!update) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit update' : update.title || 'Update'}
      size="lg"
      footer={
        editing ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={save}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        ) : readOnly ? (
          // Clients see updates as view-only — Close button only.
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        ) : (
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
            >
              <Trash2 size={13} />
              Delete
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button size="sm" onClick={() => setEditing(true)}>
                <Pencil size={13} />
                Edit
              </Button>
            </div>
          </div>
        )
      }
    >
      {confirmDelete && (
        <div className="mb-3 flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
          <p>
            Delete this update? Attachments and history will be removed; the
            audit log will record the deletion.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={doDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </Button>
          </div>
        </div>
      )}
      {editing ? (
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          <Input
            label="Title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Date & time"
              type="datetime-local"
              name="scheduledAt"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <Input
              label="Next hearing date"
              type="date"
              name="nextHearingDate"
              value={nextHearingDate}
              onChange={(e) => setNextHearingDate(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="edit-update-body"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Body
            </label>
            <textarea
              id="edit-update-body"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Attachments
            </label>
            <FileUpload
              value=""
              onChange={(url, meta) => addAttachment(url, meta)}
              category="case_note"
              caseId={caseId}
              accept=".pdf,.doc,.docx,image/*"
            />
            {attachments.length > 0 && (
              <ul className="mt-3 space-y-2">
                {attachments.map((a) => (
                  <li
                    key={a.url}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                  >
                    <span className="flex items-center gap-2 truncate text-slate-600">
                      <Paperclip size={12} className="text-slate-400" />
                      {a.name || a.url}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(a.url)}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              <span className="font-semibold text-slate-800">
                {update.authorName || 'Professional'}
              </span>
              {' · '}
              {formatDateTime(update.scheduledAt || update.createdAt)}
            </span>
            {update.nextHearingDate && (
              <Badge variant="amber">
                Next hearing {formatDate(update.nextHearingDate)}
              </Badge>
            )}
          </div>
          {update.body && (
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {update.body}
            </p>
          )}
          {Array.isArray(update.attachments) && update.attachments.length > 0 && (
            <div>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Attachments
              </h4>
              <CaseAttachmentList
                caseId={caseId}
                attachments={update.attachments}
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
