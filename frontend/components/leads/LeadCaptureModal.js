'use client';

// LeadCaptureModal — popup that collects Full Name / Email / Phone and
// POSTs to /api/leads. Used in two places:
//
//   1. Homepage hero "Discuss with AI" CTA — dismissible, redirects to
//      /search after a successful submit.
//   2. Advanced-search page gate — non-dismissible (no backdrop close,
//      no Escape, no X), shown automatically when the visitor has not yet
//      submitted the form. The page underneath stays inert until the user
//      submits.
//
// Props:
//   open        — whether the modal is visible
//   blocking    — when true, removes every dismiss path (no onClose calls,
//                 no Escape handler, no backdrop click)
//   onClose     — invoked from the close affordances when not blocking
//   onSuccess   — called with the captured lead on a successful submit
//   source      — string saved on the lead row ('Homepage AI CTA' or
//                 'Advanced Search'); defaults to 'Homepage AI CTA'
//   title       — modal heading
//   subtitle    — supporting copy under the heading

import { useEffect, useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import { submitLead } from '@/services/leadService';
import LeadOtpVerification from '@/components/leads/LeadOtpVerification';

const DEFAULT_FORM = { fullName: '', email: '', phone: '' };

// Same validators used elsewhere in the app.
function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}
function isValidPhone(v) {
  const digits = String(v || '').replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export default function LeadCaptureModal({
  open,
  blocking = false,
  onClose,
  onSuccess,
  source = 'Homepage AI CTA',
  title = 'Discuss with AI',
  subtitle = 'Share a few details so our AI can match you with the right professional.',
}) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  // Two-step flow: collect details ('form') → verify phone OTP ('otp').
  const [step, setStep] = useState('form');
  const [leadInfo, setLeadInfo] = useState(null); // { leadId, phone, otp }

  // Auto-focus the first field whenever the modal opens.
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => {
      const el = document.querySelector(
        '[data-lead-modal] input[name="fullName"]'
      );
      if (el) el.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [open]);

  // Escape closes the modal — but only when it's not blocking.
  useEffect(() => {
    if (!open || blocking) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose && onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, blocking, onClose]);

  // Reset state every time the modal opens fresh.
  useEffect(() => {
    if (open) {
      setForm(DEFAULT_FORM);
      setErrors({});
      setServerError('');
      setStep('form');
      setLeadInfo(null);
    }
  }, [open]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const next = {};
    if (!form.fullName.trim()) {
      next.fullName = 'Full name is required.';
    }
    if (!form.email.trim()) {
      next.email = 'Email is required.';
    } else if (!isValidEmail(form.email)) {
      next.email = 'Enter a valid email address.';
    }
    if (!form.phone.trim()) {
      next.phone = 'Phone number is required.';
    } else if (!isValidPhone(form.phone)) {
      next.phone = 'Enter a valid phone number.';
    }
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
      const result = await submitLead({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        source,
      });
      // Lead saved (unverified) + OTP sent — move to the verify step. We
      // only call onSuccess AFTER the phone OTP is verified.
      setLeadInfo({
        leadId: result && result.lead && result.lead.id,
        phone: form.phone.trim(),
        email: form.email.trim(),
        otp: result && result.otp,
      });
      setStep('otp');
    } catch (err) {
      // 422 with field-level errors gets surfaced inline; everything else is
      // a single banner message.
      const fieldErrors = err && err.errors;
      if (fieldErrors && typeof fieldErrors === 'object') {
        setErrors(fieldErrors);
      } else {
        setServerError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-modal-title"
      data-lead-modal
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      {/* Backdrop — click is ignored when blocking. A blocking backdrop is
          fully opaque so the page underneath cannot be peeked at; a
          dismissible one stays translucent so the visitor sees the page
          they're coming from. */}
      <div
        aria-hidden="true"
        onClick={() => {
          if (!blocking && typeof onClose === 'function') onClose();
        }}
        className={
          blocking
            ? 'absolute inset-0 bg-slate-900/90 backdrop-blur-md'
            : 'absolute inset-0 bg-slate-900/60 backdrop-blur-sm'
        }
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <Sparkles size={16} />
              </span>
              <h2
                id="lead-modal-title"
                className="text-base font-semibold text-slate-900"
              >
                {title}
              </h2>
            </div>
            <p className="mt-1.5 text-sm text-slate-500">
              {step === 'otp'
                ? 'One last step — verify your phone number to continue.'
                : subtitle}
            </p>
          </div>
          {!blocking && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {step === 'otp' ? (
          <div className="px-6 py-5">
            <LeadOtpVerification
              leadId={leadInfo && leadInfo.leadId}
              phone={leadInfo && leadInfo.phone}
              email={leadInfo && leadInfo.email}
              otp={leadInfo && leadInfo.otp}
              onVerified={() => onSuccess?.(leadInfo)}
            />
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5" noValidate>
          <Input
            label="Full name"
            name="fullName"
            value={form.fullName}
            onChange={(e) => update('fullName', e.target.value)}
            placeholder="e.g. Priya Sharma"
            required
            error={errors.fullName}
            autoComplete="name"
          />
          <Input
            label="Email address"
            name="email"
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="you@example.com"
            required
            error={errors.email}
            autoComplete="email"
          />
          <Input
            label="Phone number"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="+91 98765 43210"
            required
            error={errors.phone}
            autoComplete="tel"
          />

          {serverError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {serverError}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={submitting}
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Saving…
              </span>
            ) : (
              'Submit & continue'
            )}
          </Button>

          <p className="text-center text-[11px] text-slate-400">
            We only use these details to connect you with the right
            professional.
          </p>
        </form>
        )}
      </div>
    </div>
  );
}
