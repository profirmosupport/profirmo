'use client';

// ContactFirmModal — collects name / email / phone / optional message from a
// visitor on the firm profile page and submits it as a Lead tied to the firm
// (source = "Firm contact"). The firm sees the inquiry on their dashboard,
// admin sees it under /admin/leads with the firm name attached.

import { useState } from 'react';
import { CheckCircle2, AlertCircle, Send } from 'lucide-react';
import Modal from '@/components/common/Modal';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import { submitLead } from '@/services/leadService';

const EMPTY = { fullName: '', email: '', phone: '', message: '' };

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());

export default function ContactFirmModal({ open, onClose, firm }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');

  function reset() {
    setForm(EMPTY);
    setErrors({});
    setSubmitting(false);
    setSubmitted(false);
    setServerError('');
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  }

  function validate() {
    const next = {};
    if (!form.fullName.trim()) next.fullName = 'Name is required.';
    if (!form.email.trim()) next.email = 'Email is required.';
    else if (!isEmail(form.email)) next.email = 'Enter a valid email.';
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (!form.phone.trim()) next.phone = 'Phone is required.';
    else if (phoneDigits.length < 7) next.phone = 'Enter a valid phone.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    if (submitting) return;
    setServerError('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      await submitLead({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        message: form.message.trim() || undefined,
        source: 'Firm contact',
        firmId: firm && firm.id,
      });
      setSubmitted(true);
    } catch (err) {
      setServerError(err.message || 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onClose && onClose();
  }

  const title = submitted
    ? 'Inquiry sent'
    : `Contact ${firm && firm.firmName ? firm.firmName : 'firm'}`;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      footer={
        submitted ? (
          <Button variant="primary" size="sm" onClick={handleClose}>
            Done
          </Button>
        ) : (
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
              onClick={handleSubmit}
              disabled={submitting}
            >
              <Send className="mr-1 h-3.5 w-3.5" />
              {submitting ? 'Sending…' : 'Send inquiry'}
            </Button>
          </>
        )
      }
    >
      {submitted ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 size={22} />
          </span>
          <p className="text-sm text-slate-700">
            Thanks — the firm has received your inquiry and will be in touch
            with you shortly.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm text-slate-500">
            Share a few details and the firm will reach out. We never share
            your contact information publicly.
          </p>
          <Input
            label="Your name"
            name="fullName"
            value={form.fullName}
            onChange={handleChange}
            error={errors.fullName}
            required
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            error={errors.email}
            required
          />
          <Input
            label="Phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            error={errors.phone}
            required
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Message <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              rows={4}
              placeholder="Briefly describe how the firm can help…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
          </div>
          {serverError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      )}
    </Modal>
  );
}
