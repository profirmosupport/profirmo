'use client';

// ContactProfessionalModal — centered dialog that captures a visitor's
// contact details + case brief and submits them as a Lead tied to a
// specific professional (professionalId). Shown for professionals who
// aren't available for instant online booking, via the "Contact Details"
// button on the card and the profile header.
//
// Heavy part of the feature (form + submit + success), split into its own
// module so ContactProfessionalButton can `next/dynamic`-load it only when
// the visitor actually opens it — the closed state ships no form code.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X, Send, Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { submitLead } from '@/services/leadService';
import LeadOtpVerification from '@/components/leads/LeadOtpVerification';

// Matches the backend validator (leadService.validateLeadInput): name,
// email and phone are all required; the brief is our own requirement so
// the professional has something to act on.
function validate(form) {
  if (!form.fullName.trim()) return 'Please enter your name.';
  const phoneOk = /^\+?\d{8,15}$/.test(form.phone.replace(/[\s-]/g, ''));
  if (!phoneOk) return 'Enter a valid phone number with country code.';
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
    return 'Enter a valid email address.';
  }
  if (!form.message.trim()) return 'Tell us briefly what you need help with.';
  return null;
}

const FIELD_CLASS =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm ' +
  'focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200';

export default function ContactProfessionalModal({
  professional,
  onClose,
  onSubmitted,
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const name = (professional && professional.name) || '';
  const professionalId = professional && professional.id;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [leadInfo, setLeadInfo] = useState(null);
  // Portal target only exists on the client. Gate the render on mount so
  // createPortal never runs against an undefined document.
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    message: '',
  });

  useEffect(() => setMounted(true), []);

  // Close on Escape + lock body scroll while the dialog is open.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  function onChange(e) {
    const { name: field, value } = e.target;
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const err = validate(form);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setBusy(true);
    try {
      const result = await submitLead({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        message: form.message.trim(),
        source: 'Professional contact',
        professionalId,
      });
      // Lead saved + OTP sent — verify the phone before granting access.
      setLeadInfo({
        leadId: result && result.lead && result.lead.id,
        phone: form.phone.trim(),
        email: form.email.trim(),
        otp: result && result.otp,
      });
      setStep('otp');
      setBusy(false);
    } catch (err2) {
      setError(
        (err2 && err2.message) || 'Could not submit. Try again in a minute.'
      );
      setBusy(false);
    }
  }

  function handleVerified() {
    onSubmitted?.();
    // Redirect to /search with the thank-you banner + AI assistant.
    router.push('/search?requestVerifed');
  }

  if (!mounted) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('profCmp.contactDetails')}
        // Stop backdrop click-through so clicks inside the panel don't close.
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 bg-gradient-to-br from-amber-50 to-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {t('profCmp.contactModalTitle')}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-slate-500">
              {name
                ? t('profCmp.contactModalSubtitle', { name })
                : t('profCmp.contactModalSubtitleGeneric')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('profCmp.contactClose')}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        {step === 'otp' ? (
          <div className="px-5 py-4">
            <LeadOtpVerification
              leadId={leadInfo && leadInfo.leadId}
              phone={leadInfo && leadInfo.phone}
              email={leadInfo && leadInfo.email}
              otp={leadInfo && leadInfo.otp}
              onVerified={handleVerified}
            />
          </div>
        ) : (
        <form onSubmit={submit} className="space-y-2.5 px-5 py-4">
            <input
              name="fullName"
              value={form.fullName}
              onChange={onChange}
              placeholder={`${t('profCmp.contactName')} *`}
              autoComplete="name"
              className={FIELD_CLASS}
            />
            <input
              name="phone"
              inputMode="tel"
              value={form.phone}
              onChange={onChange}
              placeholder={`${t('profCmp.contactPhone')} *`}
              autoComplete="tel"
              className={FIELD_CLASS}
            />
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              placeholder={`${t('profCmp.contactEmail')} *`}
              autoComplete="email"
              className={FIELD_CLASS}
            />
            <textarea
              name="message"
              rows={3}
              value={form.message}
              onChange={onChange}
              placeholder={`${t('profCmp.contactBrief')} *`}
              className={`${FIELD_CLASS} resize-none`}
            />

            {error ? (
              <p className="text-xs text-red-600">{error}</p>
            ) : (
              <p className="text-[11px] leading-snug text-slate-400">
                {t('profCmp.contactConsent')}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {busy ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
              {busy
                ? t('profCmp.contactSending')
                : t('profCmp.contactSubmit')}
            </button>
        </form>
        )}
      </div>
    </div>
  );

  // Render into <body> so the fixed overlay escapes the card's transformed
  // stacking context (Card uses hover:-translate-y-1, which otherwise traps
  // a position:fixed child inside the card and makes it flicker on hover).
  return createPortal(overlay, document.body);
}
