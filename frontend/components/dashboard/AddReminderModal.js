'use client';

// AddReminderModal — shared reminder dialog for the professional dashboard.
// Supports two modes:
//   * Create: pass `defaultDate` (optionally with `dateLocked=true` for the
//     calendar-click path). The header reads "New reminder".
//   * Edit:   pass `initialReminder` — pre-fills every field, switches the
//     primary action to "Save changes" and surfaces a Delete button.
//
// After any successful create/update/delete, dispatches a
// `profirmo:reminder-changed` window event so any open calendar refreshes
// without us needing to wire callbacks through DashboardLayout.

import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import Combobox from '@/components/common/Combobox';
import bookingService from '@/services/bookingService';
import caseService from '@/services/caseService';
import {
  createReminder,
  updateReminder,
  deleteReminder,
} from '@/services/reminderService';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startTimeOf(slot) {
  const s = String(slot || '');
  const i = s.indexOf('-');
  return i > 0 ? s.slice(0, i) : s;
}

function bookingClientName(b) {
  if (!b) return 'Client';
  if (b.client && b.client.name) return b.client.name;
  if (b.clientName) return b.clientName;
  return 'Client';
}

function emitChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('profirmo:reminder-changed'));
  }
}

export default function AddReminderModal({
  open,
  onClose,
  onCreated,
  defaultDate = '',
  dateLocked = false,
  initialReminder = null,
}) {
  const isEdit = !!(initialReminder && initialReminder.id);

  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [caseId, setCaseId] = useState('');
  const [done, setDone] = useState(false);

  const [bookings, setBookings] = useState([]);
  const [cases, setCases] = useState([]);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const loadOptions = useCallback(async () => {
    setLoadingOpts(true);
    try {
      const [b, c] = await Promise.allSettled([
        bookingService.getMyAssignedBookings(),
        caseService.getMyCases(),
      ]);
      const baseBookings =
        b.status === 'fulfilled' && Array.isArray(b.value) ? b.value : [];
      const baseCases =
        c.status === 'fulfilled' && Array.isArray(c.value) ? c.value : [];

      // In edit mode the linked case/booking might not be in `mine` —
      // e.g. closed cases filtered out, or booking re-assigned. Fetch
      // the missing record so the combobox can still render its label.
      if (isEdit) {
        const linkedCaseId = initialReminder.caseId;
        if (
          linkedCaseId &&
          !baseCases.some((cc) => cc.id === linkedCaseId)
        ) {
          try {
            const extra = await caseService.getById(linkedCaseId);
            if (extra && extra.id) baseCases.push(extra);
          } catch {
            // Fallback to a stub so the dropdown still has a label.
            baseCases.push({ id: linkedCaseId, title: 'Linked case' });
          }
        }
        const linkedBookingId = initialReminder.bookingId;
        if (
          linkedBookingId &&
          !baseBookings.some((bb) => bb.id === linkedBookingId)
        ) {
          baseBookings.push({
            id: linkedBookingId,
            status: 'confirmed',
            date: '',
            time: '',
            client: { name: 'Linked booking' },
          });
        }
      }

      setBookings(baseBookings);
      setCases(baseCases);
    } finally {
      setLoadingOpts(false);
    }
  }, [isEdit, initialReminder]);

  // Reset/seed every open — defaultDate or initialReminder may have
  // changed since the last open (different cell or different pill).
  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setDate(String(initialReminder.dueDate || '').slice(0, 10));
      setTitle(initialReminder.title || '');
      setNote(initialReminder.note || '');
      setBookingId(initialReminder.bookingId || '');
      setCaseId(initialReminder.caseId || '');
      setDone(!!initialReminder.done);
    } else {
      setDate(defaultDate || todayStr());
      setTitle('');
      setNote('');
      setBookingId('');
      setCaseId('');
      setDone(false);
    }
    setError('');
    loadOptions();
  }, [open, defaultDate, initialReminder, isEdit, loadOptions]);

  // Confirmed bookings only — pending/cancelled make no sense as a future
  // reminder anchor. Always include the currently-linked one (even if it
  // isn't confirmed now) so the existing link still renders in edit mode.
  const bookingOptions = (() => {
    const list = bookings.filter(
      (b) => String(b.status || '').toLowerCase() === 'confirmed'
    );
    if (
      isEdit &&
      initialReminder.bookingId &&
      !list.some((b) => b.id === initialReminder.bookingId)
    ) {
      const linked = bookings.find((b) => b.id === initialReminder.bookingId);
      if (linked) list.push(linked);
    }
    list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return list.map((b) => ({
      value: b.id,
      label: `${String(b.date || '').slice(0, 10)} ${startTimeOf(b.time)} · ${bookingClientName(b)}`,
    }));
  })();

  const caseOptions = cases.map((c) => ({
    value: c.id,
    label: c.title || c.caseTitle || c.caseNumber || c.id,
  }));

  async function handleSubmit() {
    if (!title.trim() || !date) {
      setError('Title and date are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let row;
      if (isEdit) {
        row = await updateReminder(initialReminder.id, {
          title: title.trim(),
          note: note.trim(),
          dueDate: date,
          bookingId: bookingId || null,
          caseId: caseId || null,
          done,
        });
      } else {
        row = await createReminder({
          title: title.trim(),
          note: note.trim() || undefined,
          dueDate: date,
          bookingId: bookingId || undefined,
          caseId: caseId || undefined,
        });
      }
      emitChange();
      if (typeof onCreated === 'function') onCreated(row);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save reminder.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    setDeleting(true);
    setError('');
    try {
      await deleteReminder(initialReminder.id);
      emitChange();
      if (typeof onCreated === 'function') onCreated(null);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete reminder.');
    } finally {
      setDeleting(false);
    }
  }

  const busy = saving || deleting;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit reminder' : 'New reminder'}
      size="md"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <div>
            {isEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={busy}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} />
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={busy || !title.trim() || !date}
            >
              {isEdit ? <Save size={14} /> : <Plus size={14} />}
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add reminder'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">
            Date {dateLocked && <span className="text-slate-400">(from calendar)</span>}
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={dateLocked}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Follow up with client, file motion, etc."
            maxLength={200}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">
            Note <span className="text-slate-400">(optional)</span>
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Short context for yourself"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Combobox
            label="Link to booking"
            name="reminderBookingId"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            options={bookingOptions}
            placeholder={
              loadingOpts ? 'Loading…' : 'Search confirmed bookings…'
            }
            emptyLabel="No confirmed bookings"
          />
          <Combobox
            label="Link to case"
            name="reminderCaseId"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            options={caseOptions}
            placeholder={loadingOpts ? 'Loading…' : 'Search your cases…'}
            emptyLabel="No matching cases"
          />
        </div>

        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={done}
              onChange={(e) => setDone(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Mark as done
          </label>
        )}

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
