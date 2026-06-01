'use client';

// AddCaseModal — modal form to create OR edit a case. Reused by the
// professional and firm cases lists.
//
// Multi-client support: callers pass either a single `clientId` (legacy) or
// a `clientIds` array. The form renders a multi-select chip picker:
//   - Firm dashboard  → loads firm-aggregated clients (every member's
//                       clients, deduplicated) via getLawFirmClients().
//   - Professional    → loads only the calling professional's clients via
//                       clientService.getAll().
//
// Edit mode: when `mode === 'edit'` + `defaults.id` is set, the form
// submits PATCH /api/cases/:id instead of POST /api/cases.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ChevronDown, Users } from 'lucide-react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import PlanLimitBanner from '@/components/common/PlanLimitBanner';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Avatar from '@/components/common/Avatar';
import caseService from '@/services/caseService';
import clientService from '@/services/clientService';
import { getLawFirmClients } from '@/services/profileService';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

function emptyForm(defaults) {
  // Multi-client: accept either `clientIds` array or single `clientId`.
  const initialIds = Array.isArray(defaults && defaults.clientIds)
    ? defaults.clientIds
    : defaults && defaults.clientId
      ? [defaults.clientId]
      : [];
  // Multi-assignee: accept `professionalIds` array or single `professionalId`.
  const initialProIds = Array.isArray(defaults && defaults.professionalIds)
    ? defaults.professionalIds
    : defaults && defaults.professionalId
      ? [defaults.professionalId]
      : [];
  return {
    clientIds: [...new Set(initialIds.filter(Boolean))],
    title: (defaults && defaults.title) || '',
    category: (defaults && defaults.category) || '',
    description: (defaults && defaults.description) || '',
    priority: (defaults && defaults.priority) || 'medium',
    caseNumber: (defaults && defaults.caseNumber) || '',
    courtName: (defaults && defaults.courtName) || '',
    opposingParty: (defaults && defaults.opposingParty) || '',
    nextHearingDate: (defaults && defaults.nextHearingDate) || '',
    professionalIds: [...new Set(initialProIds.filter(Boolean))],
  };
}

export default function AddCaseModal({
  open,
  onClose,
  onCreated,
  onUpdated,
  defaults,
  firmMembers,
  mode = 'create',
  // When true the assignee picker is read-only — used when an individual
  // professional opens the Edit modal so they can't reassign the case or
  // promote it to a firm case by adding pros.
  lockAssignees = false,
}) {
  const isEdit = mode === 'edit' && defaults && defaults.id;
  const firmId = defaults && defaults.firmId;

  const [form, setForm] = useState(() => emptyForm(defaults));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Holds the raw error so PlanLimitBanner can read `payload.code` /
  // `payload.limit` etc. when the backend returned a plan-limit failure.
  const [errorObj, setErrorObj] = useState(null);
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  // Reset whenever the modal is (re)opened with new defaults.
  useEffect(() => {
    if (open) {
      setForm(emptyForm(defaults));
      setError('');
      setSubmitting(false);
    }
  }, [open, defaults]);

  // Load the client list when the modal opens. Source depends on the
  // caller's context:
  //   - Firm dashboard (firmId set)  → aggregate clients of every member.
  //   - Professional (no firmId)     → only this professional's clients.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setClientsLoading(true);
    const loader = firmId
      ? getLawFirmClients().then((d) => (d && d.items) || [])
      : clientService.getAll({ limit: 200 }).then((res) => {
          const data = (res && res.data) || [];
          return Array.isArray(data) ? data : [];
        });
    loader
      .then((list) => {
        if (active) setClients(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (active) setClients([]);
      })
      .finally(() => {
        if (active) setClientsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, firmId]);

  // --- Client multi-select ---------------------------------------------------
  const [clientQuery, setClientQuery] = useState('');
  const [clientOpen, setClientOpen] = useState(false);
  const clientRef = useRef(null);
  useEffect(() => {
    if (!clientOpen) return undefined;
    function onClick(e) {
      if (clientRef.current && !clientRef.current.contains(e.target)) {
        setClientOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [clientOpen]);

  const clientById = useMemo(() => {
    const map = new Map();
    // 1) Snapshot from defaults — used when editing a case whose client
    //    isn't part of the pro's regular client list (e.g. booking
    //    converted before the client was properly linked).
    if (Array.isArray(defaults && defaults.clientsSnapshot)) {
      for (const c of defaults.clientsSnapshot) {
        if (c && c.id) map.set(c.id, c);
      }
    }
    // 2) Loaded list — wins over the snapshot (newer data).
    for (const c of clients) map.set(c.id, c);
    return map;
  }, [clients, defaults]);

  // Always render a chip per selected id. If the client somehow isn't in
  // the snapshot OR the loaded list, fall back to a labelled placeholder
  // so the chip is at least removable and the count stays correct.
  const selectedClients = form.clientIds.map((id) => {
    const match = clientById.get(id);
    if (match) return match;
    return { id, name: `Client ${String(id).slice(-8)}`, email: '', phone: '' };
  });

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    return clients
      .filter((c) => !form.clientIds.includes(c.id))
      .filter((c) =>
        !q
          ? true
          : [c.name, c.email, c.phone]
              .map((s) => String(s || '').toLowerCase())
              .some((s) => s.includes(q))
      );
  }, [clients, form.clientIds, clientQuery]);

  function addClient(id) {
    setForm((f) =>
      f.clientIds.includes(id)
        ? f
        : { ...f, clientIds: [...f.clientIds, id] }
    );
    setClientQuery('');
  }
  function removeClient(id) {
    setForm((f) => ({ ...f, clientIds: f.clientIds.filter((x) => x !== id) }));
  }

  // --- Assignee picker (firm-only) -------------------------------------------
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const assigneeRef = useRef(null);
  useEffect(() => {
    if (!assigneeOpen) return undefined;
    function onClick(e) {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target)) {
        setAssigneeOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [assigneeOpen]);

  const memberOptions = useMemo(() => {
    if (!Array.isArray(firmMembers)) return [];
    return firmMembers
      .map((m) => {
        const p = m.professional || {};
        return {
          publicId: m.publicId || p.publicId || null,
          name: m.name || p.name || '',
          email: m.email || p.email || '',
          profilePhoto: m.profilePhoto || p.profilePhoto || null,
          professionalType: m.professionalType || p.professionalType || '',
          role: m.role || '',
        };
      })
      .filter((x) => x.publicId);
  }, [firmMembers]);

  const filteredMembers = useMemo(() => {
    const q = assigneeQuery.trim().toLowerCase();
    if (!q) return memberOptions;
    return memberOptions.filter((m) =>
      [m.name, m.email, m.professionalType]
        .map((s) => String(s || '').toLowerCase())
        .some((s) => s.includes(q))
    );
  }, [assigneeQuery, memberOptions]);

  // Multi-select assignee state — list of publicIds.
  const filteredMembersForPicker = filteredMembers.filter(
    (m) => !form.professionalIds.includes(m.publicId)
  );
  const selectedMembers = form.professionalIds
    .map((pid) => memberOptions.find((m) => m.publicId === pid))
    .filter(Boolean);

  function addAssignee(pid) {
    if (!pid) return;
    setForm((f) =>
      f.professionalIds.includes(pid)
        ? f
        : { ...f, professionalIds: [...f.professionalIds, pid] }
    );
    setAssigneeQuery('');
  }
  function removeAssignee(pid) {
    setForm((f) => ({
      ...f,
      professionalIds: f.professionalIds.filter((x) => x !== pid),
    }));
  }

  function update(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
  }
  function handleChange(e) {
    update(e.target.name, e.target.value);
  }

  async function submit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (submitting) return;
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!form.category.trim()) {
      setError('Category is required.');
      return;
    }
    // Spec: a case must have at least one client and one assigned
    // professional. The picker prevents removing the last entry but a
    // user can also reach this state by clearing during edit, so we
    // re-validate on submit.
    const clientIds = (form.clientIds || []).filter(Boolean);
    if (clientIds.length === 0) {
      setError('At least one client is required.');
      return;
    }
    const proIds = (form.professionalIds || []).filter(Boolean);
    if (proIds.length === 0) {
      setError('At least one professional must be assigned to the case.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const payload = {
        clientIds: form.clientIds,
        title: form.title.trim(),
        category: form.category.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority || 'medium',
        caseNumber: form.caseNumber.trim() || undefined,
        courtName: form.courtName.trim() || undefined,
        opposingParty: form.opposingParty.trim() || undefined,
        nextHearingDate: form.nextHearingDate || undefined,
      };
      if (!isEdit) payload.status = 'open';
      if (firmId) payload.firmId = firmId;
      // Multi-assignee — send the full array. The backend mirrors the
      // primary `professionalId` from the first entry. On edit, send the
      // array even when empty so the user can fully un-assign a case.
      const cleanedProIds = form.professionalIds.filter(Boolean);
      if (cleanedProIds.length > 0) {
        payload.professionalIds = cleanedProIds;
      } else if (isEdit) {
        payload.professionalIds = [];
      }

      if (isEdit) {
        const updated = await caseService.update(defaults.id, payload);
        if (typeof onUpdated === 'function') onUpdated(updated);
      } else {
        const created = await caseService.create(payload);
        if (typeof onCreated === 'function') onCreated(created);
      }
      if (typeof onClose === 'function') onClose();
    } catch (err) {
      // Plan-limit failures render a richer banner with an upgrade CTA —
      // keep the raw error object so PlanLimitBanner can read the payload.
      setErrorObj(err);
      // Suppress the plain-text fallback when the limit banner is going
      // to handle it; otherwise show the generic message.
      const isPlanLimit =
        err && err.payload && err.payload.code === 'PLAN_LIMIT_REACHED';
      setError(isPlanLimit ? '' : err.message || 'Could not save case.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    if (typeof onClose === 'function') onClose();
  }

  const submitLabel = submitting
    ? isEdit
      ? 'Saving…'
      : 'Creating…'
    : isEdit
      ? 'Save changes'
      : 'Create case';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? 'Edit case' : 'New case'}
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
            {submitLabel}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        {/* --- Client multi-select ----------------------------------------- */}
        <div ref={clientRef} className="relative">
          <label
            htmlFor="case-clients"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Clients
          </label>
          {selectedClients.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {selectedClients.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                >
                  {c.name || c.email || c.phone || c.id}
                  <button
                    type="button"
                    onClick={() => removeClient(c.id)}
                    className="text-blue-400 hover:text-red-600"
                    aria-label={`Remove ${c.name || 'client'}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="case-clients"
              type="text"
              value={clientQuery}
              onChange={(e) => {
                setClientQuery(e.target.value);
                setClientOpen(true);
              }}
              onFocus={() => setClientOpen(true)}
              placeholder={
                clientsLoading
                  ? 'Loading clients…'
                  : clients.length === 0
                    ? 'No clients available yet'
                    : 'Search clients by name, phone, or email…'
              }
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-9 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          {clientOpen && filteredClients.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              {filteredClients.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      addClient(c.id);
                      setClientOpen(false);
                    }}
                    className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-blue-50"
                  >
                    <Avatar
                      src={c.profilePhoto}
                      name={c.name || c.email || 'Client'}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {c.name || c.email || c.phone || c.id}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {[c.phone, c.email].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-xs text-slate-500">
            <Users size={11} className="mr-0.5 inline" />
            Select one or more clients.{' '}
            {firmId
              ? 'Showing every client linked to a firm member.'
              : 'Showing only your linked clients.'}
          </p>
        </div>

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
            placeholder="e.g. Civil litigation"
          />
        </div>

        <div>
          <label
            htmlFor="case-description"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Description
          </label>
          <textarea
            id="case-description"
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
          <Input
            label="Case number"
            name="caseNumber"
            value={form.caseNumber}
            onChange={handleChange}
            placeholder="Optional"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Court name"
            name="courtName"
            value={form.courtName}
            onChange={handleChange}
            placeholder="Optional"
          />
          <Input
            label="Opposing party"
            name="opposingParty"
            value={form.opposingParty}
            onChange={handleChange}
            placeholder="Optional"
          />
        </div>
        <Input
          label="Next hearing date"
          name="nextHearingDate"
          type="date"
          value={form.nextHearingDate}
          onChange={handleChange}
        />

        {/* Multi-assignee picker — only when the caller passes a member
            list (firm dashboard). Professional dashboard auto-assigns the
            creator via defaults.professionalIds. */}
        {Array.isArray(firmMembers) && firmMembers.length > 0 && (
          <div ref={assigneeRef} className="relative">
            <label
              htmlFor="case-assignee"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Assign to professionals
              {lockAssignees && (
                <span className="ml-2 text-xs font-normal text-slate-500">
                  (locked — only the firm admin can change assignees)
                </span>
              )}
            </label>
            {selectedMembers.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {selectedMembers.map((m) => (
                  <span
                    key={m.publicId}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                  >
                    <Avatar
                      src={m.profilePhoto}
                      name={m.name}
                      size="xs"
                    />
                    {m.name || m.email || m.publicId}
                    {!lockAssignees && (
                      <button
                        type="button"
                        onClick={() => removeAssignee(m.publicId)}
                        className="text-emerald-400 hover:text-red-600"
                        aria-label={`Remove ${m.name || 'assignee'}`}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="case-assignee"
                type="text"
                value={assigneeQuery}
                onChange={(e) => {
                  if (lockAssignees) return;
                  setAssigneeQuery(e.target.value);
                  setAssigneeOpen(true);
                }}
                onFocus={() => {
                  if (!lockAssignees) setAssigneeOpen(true);
                }}
                placeholder={
                  lockAssignees
                    ? 'Assignees locked'
                    : memberOptions.length === 0
                      ? 'No professionals in your firm yet'
                      : 'Search by name, email, or type…'
                }
                autoComplete="off"
                readOnly={lockAssignees}
                disabled={lockAssignees}
                className={`w-full rounded-lg border py-2.5 pl-9 pr-9 text-sm transition-colors focus:outline-none focus:ring-2 ${
                  lockAssignees
                    ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500'
                    : 'border-slate-300 text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-200'
                }`}
              />
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            {assigneeOpen && memberOptions.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {filteredMembersForPicker.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-slate-500">
                    {selectedMembers.length === memberOptions.length
                      ? 'All firm members already added.'
                      : 'No matches.'}
                  </li>
                ) : (
                  filteredMembersForPicker.map((m) => (
                    <li key={m.publicId}>
                      <button
                        type="button"
                        onClick={() => {
                          addAssignee(m.publicId);
                          setAssigneeQuery('');
                          setAssigneeOpen(false);
                        }}
                        className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-emerald-50"
                      >
                        <Avatar
                          src={m.profilePhoto}
                          name={m.name}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {m.name || '—'}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {m.email}
                            {m.professionalType
                              ? ` · ${m.professionalType}`
                              : ''}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">
                          {m.role}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Pick one or more firm members. Leave empty to keep the case
              unassigned.
            </p>
          </div>
        )}

        <button type="submit" className="hidden" aria-hidden="true" />
        <PlanLimitBanner err={errorObj} />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
