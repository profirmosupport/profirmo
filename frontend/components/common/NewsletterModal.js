'use client';

// NewsletterModal — opens after a visitor successfully submits their
// email in the footer subscribe form. Collects optional follow-up
// details (name, phone, city, interests) and PATCHes them onto the
// already-created subscriber row. Every field is optional; "Skip"
// closes the modal with the subscription intact.

import { useState } from 'react';
import { Mail, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import { completeProfile } from '@/services/newsletterService';

export default function NewsletterModal({ open, email, onClose }) {
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    city: '',
    interests: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await completeProfile({
        email,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        interests: form.interests.trim(),
      });
      setDone(true);
    } catch (err) {
      setError(err.message || 'Could not save your details.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    setForm({ fullName: '', phone: '', city: '', interests: '' });
    setError('');
    setDone(false);
    if (typeof onClose === 'function') onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="You're on the list"
      size="md"
      footer={
        done ? (
          <Button variant="primary" size="sm" onClick={handleClose}>
            Close
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={submitting}
            >
              Skip for now
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving…
                </>
              ) : (
                'Save details'
              )}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        {/* Confirmation banner — always shown, reinforces the email
            actually made it to our DB so the visitor doesn't worry the
            modal means the subscribe failed. */}
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>
            Thanks! We&apos;ll send updates to{' '}
            <span className="font-mono text-xs">{email}</span>.
          </span>
        </div>

        {done ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-700">
            All set — your details are saved.
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Help us tailor what we send. All fields are optional — leave
              them blank and we&apos;ll still keep you on the list.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                label="Full name"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                placeholder="e.g. Priya Sharma"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Phone (optional)"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+91 ..."
                />
                <Input
                  label="City"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="e.g. Mumbai"
                />
              </div>
              <Input
                label="Interests"
                name="interests"
                value={form.interests}
                onChange={handleChange}
                placeholder="legal, tax, GST, startup advisory…"
                hint="Comma-separated. We'll prioritise content matching these."
              />
              <button type="submit" hidden aria-hidden="true" />
            </form>
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
