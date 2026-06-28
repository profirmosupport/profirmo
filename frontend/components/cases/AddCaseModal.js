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
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Gavel,
  Loader2,
  ScanSearch,
  Search,
  Users,
  X,
} from 'lucide-react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import PlanLimitBanner from '@/components/common/PlanLimitBanner';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Avatar from '@/components/common/Avatar';
import caseService from '@/services/caseService';
import clientService from '@/services/clientService';
import { getLawFirmClients } from '@/services/profileService';
import {
  getCaseByCnr,
  getImportedCase,
  importCaseFromEcourts,
} from '@/services/ecourtsService';

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
    cnr: (defaults && defaults.cnr) || '',
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

  // CNR-lookup state — only relevant in CREATE mode. When `lookup` is
  // set, the form's other fields are prefilled from the upstream
  // E-Courts blob and `submit()` routes through the import endpoint
  // (so the eciSnapshot is saved + source='ecourts') instead of the
  // plain create endpoint.
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookup, setLookup] = useState(null);
  const [existingCase, setExistingCase] = useState({
    imported: false,
    caseId: null,
  });

  // Reset whenever the modal is (re)opened with new defaults.
  useEffect(() => {
    if (open) {
      setForm(emptyForm(defaults));
      setError('');
      setSubmitting(false);
      setLookupBusy(false);
      setLookupError('');
      setLookup(null);
      setExistingCase({ imported: false, caseId: null });
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

  // CNR lookup — fetches the upstream E-Courts blob and prefills the
  // form. Also checks whether the same CNR is already saved on this
  // user's dashboard, so we can offer "Open existing" instead of a
  // duplicate import.
  async function runCnrLookup() {
    if (lookupBusy) return;
    const trimmed = form.cnr.trim().toUpperCase();
    if (!trimmed) {
      setLookupError('Enter a CNR to look up.');
      return;
    }
    setLookupBusy(true);
    setLookupError('');
    setLookup(null);
    try {
      const [detail, mine] = await Promise.all([
        getCaseByCnr(trimmed),
        getImportedCase(trimmed).catch(() => ({
          imported: false,
          caseId: null,
        })),
      ]);
      const court = (detail && detail.courtCaseData) || null;
      if (!court) {
        setLookupError(
          'No case found for this CNR on E-Courts. Double-check the number and try again.'
        );
        return;
      }
      setLookup(detail);
      setExistingCase(mine || { imported: false, caseId: null });
      // Prefill form fields from the upstream blob — the pro can still
      // tweak any of them before saving (overrides ride along).
      const petitioner = (court.petitioners || []).filter(Boolean)[0] || '';
      const respondent = (court.respondents || []).filter(Boolean)[0] || '';
      const title =
        petitioner && respondent
          ? `${petitioner} vs ${respondent}`
          : petitioner || court.cnr || '';
      const acts = Array.isArray(court.actsAndSections)
        ? court.actsAndSections.filter(Boolean).join(', ')
        : '';
      const nextHearing = court.nextHearingDate
        ? String(court.nextHearingDate).slice(0, 10)
        : '';
      setForm((f) => ({
        ...f,
        cnr: trimmed,
        title: f.title || title,
        category:
          f.category || court.judicialSection || court.caseCategory || 'Litigation',
        description: f.description || acts,
        caseNumber: f.caseNumber || court.caseNumber || court.filingNumber || '',
        courtName: f.courtName || court.courtName || court.courtCode || '',
        opposingParty: f.opposingParty || respondent,
        nextHearingDate: f.nextHearingDate || nextHearing,
      }));
    } catch (err) {
      setLookupError(
        err.message ||
          'Could not fetch this case from E-Courts. Try again in a moment.'
      );
    } finally {
      setLookupBusy(false);
    }
  }

  function clearLookup() {
    setLookup(null);
    setExistingCase({ imported: false, caseId: null });
    setLookupError('');
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
        // CNR (Case Number Record) is the unique 16-char identifier
        // every Indian court issues — gating for E-Courts sync.
        cnr: form.cnr.trim().toUpperCase() || undefined,
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
      } else if (lookup) {
        // CNR was successfully looked up — route through the import
        // endpoint so the case row carries the full eciSnapshot +
        // source='ecourts' (enabling future one-click sync). The
        // pro's edits to the prefilled fields ride along as overrides.
        const result = await importCaseFromEcourts(
          form.cnr.trim().toUpperCase(),
          {
            clientIds: form.clientIds,
            overrides: {
              title: payload.title,
              category: payload.category,
              description: payload.description,
              priority: payload.priority,
              caseNumber: payload.caseNumber,
              courtName: payload.courtName,
              opposingParty: payload.opposingParty,
              nextHearingDate: payload.nextHearingDate,
            },
          }
        );
        if (typeof onCreated === 'function') onCreated(result && result.case);
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
        {/* --- CNR lookup banner (create-only) -----------------------------
            Litigators almost always want to start a new case from a CNR
            because it pulls parties, court, hearings + orders straight
            from E-Courts. The banner lets them paste a 16-char CNR,
            click "Look up", and have the rest of the form pre-fill —
            or skip and fill in manually. */}
        {!isEdit ? (
          <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/80 p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800">
                <ScanSearch size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  Have a CNR? Pull case details from E-Courts
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  We pre-fill the parties, court, hearings & orders. You
                  can also skip and enter the case details manually.
                </p>
                <div className="mt-3 flex flex-wrap items-stretch gap-2">
                  <input
                    type="text"
                    name="cnr"
                    value={form.cnr}
                    onChange={(e) => {
                      // If the user edits the CNR after a successful
                      // lookup, treat it as a new search — clear the
                      // snapshot so submit() falls back to plain create.
                      if (lookup) clearLookup();
                      update('cnr', e.target.value);
                    }}
                    placeholder="e.g. SCIN010229632021"
                    autoComplete="off"
                    className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono uppercase tracking-wide text-slate-800 placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        runCnrLookup();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={runCnrLookup}
                    disabled={lookupBusy || !form.cnr.trim()}
                  >
                    {lookupBusy ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Looking up…
                      </>
                    ) : (
                      <>
                        <ScanSearch size={14} />
                        Look up
                      </>
                    )}
                  </Button>
                </div>
                {lookupError ? (
                  <p className="mt-2 inline-flex items-start gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    {lookupError}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Snapshot once we have a successful lookup. */}
            {lookup && lookup.courtCaseData ? (
              <CnrSnapshot
                court={lookup.courtCaseData}
                existing={existingCase}
                onClear={() => {
                  clearLookup();
                  // Also reset the form back to empty so the pro can
                  // start over with a fresh manual entry.
                  setForm((f) => emptyForm({ ...defaults, cnr: '' }));
                }}
              />
            ) : null}
          </div>
        ) : null}

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
          {/* In edit mode the CNR sits inline with other case
              metadata. In create mode it lives in the CNR-lookup
              banner at the top of the form (see above). */}
          {isEdit ? (
            <Input
              label="CNR (E-Courts)"
              name="cnr"
              value={form.cnr}
              onChange={handleChange}
              placeholder="e.g. DLCT01-001234-2024"
              hint="Adding a CNR unlocks one-click sync of hearings & orders from E-Courts India."
            />
          ) : null}
          <Input
            label="Court name"
            name="courtName"
            value={form.courtName}
            onChange={handleChange}
            placeholder="Optional"
          />
        </div>
        <Input
          label="Opposing party"
          name="opposingParty"
          value={form.opposingParty}
          onChange={handleChange}
          placeholder="Optional"
        />
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

function fmtIndianDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

function SnapshotFact({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <span className="text-[12px] font-semibold text-slate-800">
        {value || '—'}
      </span>
    </div>
  );
}

/**
 * CnrSnapshot — preview card rendered inside the CNR lookup banner
 * after a successful upstream fetch. Shows the key facts so the pro
 * can confirm they have the right case before saving, and surfaces a
 * "you already have this case" link when the CNR is already on the
 * dashboard.
 */
function CnrSnapshot({ court, existing, onClear }) {
  const petitioners = (court.petitioners || []).filter(Boolean);
  const respondents = (court.respondents || []).filter(Boolean);
  const judges = (court.judges || []).filter(Boolean);
  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-white/80 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">
          {petitioners[0] || court.cnr}
          {respondents[0] ? (
            <span className="font-normal text-slate-400"> vs </span>
          ) : null}
          {respondents[0] ? (
            <span className="text-slate-800">{respondents[0]}</span>
          ) : null}
        </p>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
          {court.caseStatus || 'Unknown'}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
        <SnapshotFact label="Case type" value={court.caseType} />
        <SnapshotFact label="Case number" value={court.caseNumber} />
        <SnapshotFact
          label="Court"
          value={court.courtName || court.courtCode}
        />
        <SnapshotFact
          label="District / State"
          value={[court.district, court.state].filter(Boolean).join(', ')}
        />
        <SnapshotFact label="Filed" value={fmtIndianDate(court.filingDate)} />
        <SnapshotFact label="Decision" value={fmtIndianDate(court.decisionDate)} />
        <SnapshotFact
          label="Next hearing"
          value={fmtIndianDate(court.nextHearingDate)}
        />
        <SnapshotFact
          label="Acts & sections"
          value={
            Array.isArray(court.actsAndSections) &&
            court.actsAndSections.length > 0
              ? court.actsAndSections.slice(0, 2).join(', ') +
                (court.actsAndSections.length > 2 ? '…' : '')
              : null
          }
        />
      </dl>
      {judges.length > 0 ? (
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-500">
          <Gavel size={11} className="text-slate-400" />
          {judges.slice(0, 2).join(', ')}
          {judges.length > 2 ? ` +${judges.length - 2} more` : ''}
        </p>
      ) : null}

      {existing && existing.imported && existing.caseId ? (
        <a
          href={`/dashboard/professional/cases/${existing.caseId}`}
          className="mt-3 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 transition hover:bg-emerald-100"
        >
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold">You already have this case.</span>{' '}
            Click to open it instead of saving a duplicate.
          </span>
        </a>
      ) : (
        <button
          type="button"
          onClick={onClear}
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
        >
          <X size={11} />
          Clear &amp; enter manually
        </button>
      )}
    </div>
  );
}
