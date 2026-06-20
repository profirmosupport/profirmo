'use client';

// LeadGenFloater — floating, collapsable lead-capture pill that sits on the
// bottom-right of CMS / blog / landing pages. Posts to POST /api/leads
// (public, anonymous — the existing leadService handles dedupe + sets the
// pf_lead httpOnly cookie). Once submitted the floater stays in "thanks"
// mode for the session.

import { useState, useEffect } from 'react';
import { MessageCircle, X, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/utils/constants';

const STORAGE_KEY = 'pf_lead_floater_submitted';

export default function LeadGenFloater({ source = 'cms-floater' }) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    message: '',
  });

  // Don't show the form on every page if the visitor already submitted
  // earlier in this browser session. Re-engagement happens via the cookie
  // the backend already sets (/api/leads/me reads it for the in-page popup).
  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === '1') setSubmitted(true);
    } catch {}
  }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function isValid() {
    if (!form.fullName.trim()) return 'Please enter your name.';
    const phoneOk = /^\+?\d{8,15}$/.test(form.phone.replace(/[\s-]/g, ''));
    if (!phoneOk) return 'Enter a valid phone number with country code.';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      return 'Enter a valid email address (or leave blank).';
    }
    if (!form.message.trim()) {
      return 'Tell us briefly what you need help with.';
    }
    return null;
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const err = isValid();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          message: form.message.trim(),
          source,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Could not submit. Try again in a minute.');
      }
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {}
      setSubmitted(true);
    } catch (err2) {
      setError(err2.message || 'Could not submit. Try again.');
    } finally {
      setBusy(false);
    }
  }

  // Collapsed pill — always visible, bottom-right.
  if (!open && !submitted) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-700 sm:bottom-6 sm:right-6"
        aria-label="Get a free callback"
      >
        <MessageCircle size={16} />
        <span className="hidden sm:inline">Get a free callback</span>
        <span className="sm:hidden">Callback</span>
      </button>
    );
  }

  // Already submitted this session — minimised acknowledgement pill.
  if (submitted) {
    return (
      <div className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 shadow-lg sm:bottom-6 sm:right-6">
        <CheckCircle2 size={14} />
        We&apos;ll be in touch shortly.
      </div>
    );
  }

  // Expanded form panel.
  return (
    <div
      role="dialog"
      aria-label="Request a callback"
      className="fixed bottom-5 right-5 z-40 w-[calc(100vw-2.5rem)] max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:bottom-6 sm:right-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 bg-gradient-to-br from-amber-50 to-white px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Talk to a verified expert
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            Share your contact + a one-liner; we&apos;ll match you in minutes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={14} />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={submit} className="space-y-2 px-4 py-3">
        <input
          name="fullName"
          value={form.fullName}
          onChange={onChange}
          placeholder="Full name *"
          autoComplete="name"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
        <input
          name="phone"
          inputMode="tel"
          value={form.phone}
          onChange={onChange}
          placeholder="Phone with country code *"
          autoComplete="tel"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
        <input
          name="email"
          type="email"
          value={form.email}
          onChange={onChange}
          placeholder="Email (optional)"
          autoComplete="email"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
        <textarea
          name="message"
          rows={3}
          value={form.message}
          onChange={onChange}
          placeholder="What do you need help with? *"
          className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
        />

        {error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : (
          <p className="text-[11px] leading-snug text-slate-400">
            By submitting you agree to be contacted by Pro Firmo regarding your
            request. We never share your details.
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white shadow transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          {busy ? 'Sending…' : 'Request callback'}
        </button>
      </form>
    </div>
  );
}
