'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import caseService from '@/services/caseService';
import clientService from '@/services/clientService';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

function emptyForm(defaults) {
  return {
    clientId: (defaults && defaults.clientId) || '',
    title: (defaults && defaults.title) || '',
    category: (defaults && defaults.category) || '',
    description: (defaults && defaults.description) || '',
    priority: (defaults && defaults.priority) || 'medium',
    caseNumber: (defaults && defaults.caseNumber) || '',
    courtName: (defaults && defaults.courtName) || '',
    opposingParty: (defaults && defaults.opposingParty) || '',
    nextHearingDate: (defaults && defaults.nextHearingDate) || '',
    professionalId: (defaults && defaults.professionalId) || '',
  };
}

/**
 * AddCaseModal — modal form to create a case. Reused by the professional and
 * firm cases lists.
 *
 * Props: { open, onClose, onCreated, defaults }
 *   `defaults` may include `firmId` (shows the "Assign to professional"
 *   field) and any pre-filled form values.
 */
export default function AddCaseModal({ open, onClose, onCreated, defaults }) {
  const [form, setForm] = useState(() => emptyForm(defaults));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(emptyForm(defaults));
      setError('');
      setSubmitting(false);
    }
  }, [open, defaults]);

  // Load the client list the first time the modal opens.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setClientsLoading(true);
    clientService
      .getAll({ limit: 200 })
      .then((res) => {
        if (!active) return;
        const data = (res && res.data) || [];
        setClients(Array.isArray(data) ? data : []);
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
  }, [open]);

  const clientOptions = useMemo(() => {
    const opts = clients.map((c) => ({
      value: c.id,
      label: `${c.name || c.email || c.phone || c.id}${
        c.phone ? ` · ${c.phone}` : ''
      }`,
    }));
    opts.unshift({ value: '', label: '— Select a client —' });
    return opts;
  }, [clients]);

  const firmId = defaults && defaults.firmId;

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

    setError('');
    setSubmitting(true);
    try {
      const payload = {
        clientId: form.clientId.trim() || undefined,
        title: form.title.trim(),
        category: form.category.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority || 'medium',
        caseNumber: form.caseNumber.trim() || undefined,
        courtName: form.courtName.trim() || undefined,
        opposingParty: form.opposingParty.trim() || undefined,
        nextHearingDate: form.nextHearingDate || undefined,
        status: 'open',
      };
      if (firmId) payload.firmId = firmId;
      if (firmId && form.professionalId.trim()) {
        payload.professionalId = form.professionalId.trim();
      }

      const created = await caseService.create(payload);
      if (typeof onCreated === 'function') onCreated(created);
      if (typeof onClose === 'function') onClose();
    } catch (err) {
      setError(err.message || 'Could not create case.');
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
      title="New case"
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
            {submitting ? 'Creating…' : 'Create case'}
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
          hint={
            clientsLoading
              ? 'Loading clients…'
              : clients.length === 0
                ? 'No clients on file yet — add one from the Clients module.'
                : 'Pick the client this case is for.'
          }
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
        {firmId && (
          <Input
            label="Assign to professional"
            name="professionalId"
            value={form.professionalId}
            onChange={handleChange}
            placeholder="prof-N or pdetail-..."
            hint="Leave blank to create unassigned."
          />
        )}
        <button type="submit" className="hidden" aria-hidden="true" />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
