'use client';

// LandingLeadForm — the inline, fully-bilingual lead form on the /consult
// landing page. Same funnel as every other form: save the lead, verify the
// phone via OTP, then redirect to /search?requestVerifed. Reuses submitLead
// + LeadOtpVerification so there's one OTP flow across the site.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { submitLead } from '@/services/leadService';
import LeadOtpVerification from '@/components/leads/LeadOtpVerification';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{8,15}$/;

export default function LandingLeadForm({
  source = 'Landing page',
  prefillMessage = '',
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    message: prefillMessage,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [leadInfo, setLeadInfo] = useState(null);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setError('');
  }

  function validate() {
    if (!form.fullName.trim()) return t('landing.form.errName');
    if (!PHONE_RE.test(form.phone.replace(/[\s-]/g, ''))) {
      return t('landing.form.errPhone');
    }
    if (!EMAIL_RE.test(form.email.trim())) return t('landing.form.errEmail');
    if (!form.message.trim()) return t('landing.form.errMessage');
    return '';
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await submitLead({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        message: form.message.trim(),
        source,
      });
      setLeadInfo({
        leadId: result && result.lead && result.lead.id,
        phone: form.phone.trim(),
        email: form.email.trim(),
        otp: result && result.otp,
      });
      setStep('otp');
    } catch (err2) {
      setError((err2 && err2.message) || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const FIELD =
    'w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200';

  return (
    <div
      id="lead-form"
      className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-6"
    >
      {step === 'otp' ? (
        <>
          <p className="text-base font-semibold text-slate-900">
            {t('landing.form.verifyTitle')}
          </p>
          <div className="mt-4">
            <LeadOtpVerification
              leadId={leadInfo && leadInfo.leadId}
              phone={leadInfo && leadInfo.phone}
              email={leadInfo && leadInfo.email}
              otp={leadInfo && leadInfo.otp}
              onVerified={() => router.push('/search?requestVerifed')}
            />
          </div>
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-slate-900">
            {t('landing.form.title')}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {t('landing.form.subtitle')}
          </p>
          <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
            <input
              name="fullName"
              value={form.fullName}
              onChange={onChange}
              placeholder={`${t('landing.form.name')} *`}
              autoComplete="name"
              className={FIELD}
            />
            <input
              name="phone"
              inputMode="tel"
              value={form.phone}
              onChange={onChange}
              placeholder={`${t('landing.form.phone')} *`}
              autoComplete="tel"
              className={FIELD}
            />
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              placeholder={`${t('landing.form.email')} *`}
              autoComplete="email"
              className={FIELD}
            />
            <textarea
              name="message"
              rows={3}
              value={form.message}
              onChange={onChange}
              placeholder={`${t('landing.form.message')} *`}
              className={`${FIELD} resize-none`}
            />

            {error ? (
              <p className="text-xs text-red-600">{error}</p>
            ) : (
              <p className="flex items-center gap-1.5 text-[11px] leading-snug text-slate-400">
                <ShieldCheck size={12} className="shrink-0 text-emerald-500" />
                {t('landing.form.otpNote')}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:from-amber-700 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowRight size={16} />
              )}
              {t('landing.form.submit')}
            </button>

            <p className="text-center text-[11px] leading-snug text-slate-400">
              {t('landing.form.consent')}
            </p>
          </form>
        </>
      )}
    </div>
  );
}
