'use client';

// ChangePhoneModal — runs the phone-OTP flow against a new number, then
// submits POST /api/auth/change-phone. The backend rejects if another
// user already holds the new number.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Smartphone,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import {
  changePhone,
  checkPhone,
  sendPhoneOtp,
  verifyPhoneOtp,
} from '@/services/authService';

const RESEND_COOLDOWN_SECONDS = 300;

function toE164(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.slice(1).replace(/[^0-9]/g, '');
  }
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (digits.length === 10) return '+91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return '+' + digits;
  return '+' + digits;
}

function fmtMmSs(t) {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ChangePhoneModal({
  open,
  currentPhone,
  onClose,
  onChanged,
}) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [step, setStep] = useState('enter-phone'); // 'enter-phone' | 'enter-code'
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resendIn, setResendIn] = useState(0);

  // Reset every time the modal opens.
  useEffect(() => {
    if (!open) return;
    setStep('enter-phone');
    setPhone('');
    setOtp('');
    setSentTo('');
    setError('');
    setInfo('');
    setResendIn(0);
  }, [open]);

  // Cooldown ticker.
  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setInterval(() => {
      setResendIn((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  if (!open) return null;
  // SSR guard — createPortal needs `document`, which doesn't exist during
  // server render. The component is in a 'use client' file so this is only
  // true on the very first paint before hydration completes.
  if (typeof document === 'undefined') return null;

  async function handleSendOtp(e) {
    e && e.preventDefault();
    setError('');
    setInfo('');
    const e164 = toE164(phone);
    if (!/^\+\d{8,15}$/.test(e164)) {
      setError('Enter a valid phone number including the country code.');
      return;
    }
    if (e164 === currentPhone) {
      setError('This is already your current number.');
      return;
    }
    setSubmitting(true);
    try {
      // Pre-flight: reject numbers already attached to ANY account before
      // burning an OTP. The /api/auth/change-phone endpoint will also reject
      // on its own — this is defense in depth + faster UX (no SMS round-trip
      // to discover the conflict).
      const check = await checkPhone(e164);
      if (check && check.exists) {
        setError(
          'This phone number is already attached to another account. Use a different number.'
        );
        return;
      }
      await sendPhoneOtp(e164, 'change-phone');
      setSentTo(e164);
      setStep('enter-code');
      setInfo(`We sent a 6-digit code to ${e164}.`);
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(
        (err && (err.message || err.code)) ||
          'Could not send the OTP. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    if (!sentTo) {
      setError('Please request a new OTP first.');
      setStep('enter-phone');
      return;
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter the 6-digit code from the SMS.');
      return;
    }
    setSubmitting(true);
    try {
      await verifyPhoneOtp(sentTo, 'change-phone', otp.trim());
      // Backend re-checks ownership + uniqueness; surface conflicts inline.
      const result = await changePhone(sentTo);
      const newPhone = (result && result.mobileNumber) || sentTo;
      if (typeof onChanged === 'function') onChanged(newPhone);
    } catch (err) {
      setError(
        (err && err.message) ||
          'Could not change your phone number. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resending || resendIn > 0) return;
    setResending(true);
    setError('');
    setInfo('');
    try {
      const target = sentTo || toE164(phone);
      await sendPhoneOtp(target, 'change-phone');
      setSentTo(target);
      setInfo(`A new code was sent to ${target}.`);
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(
        (err && err.message) || 'Could not resend the OTP. Please try again.'
      );
    } finally {
      setResending(false);
    }
  }

  // Portal the modal to <body>. The PersonalInfoForm / pro form wrap their
  // content in a <form>; rendering this modal as a DOM descendant of that
  // form would mean a nested <form>, which the HTML spec doesn't allow and
  // browsers flatten — pressing Enter in the modal's phone input would
  // submit the OUTER form and bounce the user. Portalling sidesteps it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">
            Change mobile number
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm text-teal-800">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>{info}</span>
            </div>
          )}

          {currentPhone && (
            <p className="text-xs text-slate-500">
              Current number:{' '}
              <span className="font-mono text-slate-700">{currentPhone}</span>
            </p>
          )}

          {step === 'enter-phone' && (
            <form onSubmit={handleSendOtp} className="space-y-3" noValidate>
              <div>
                <label
                  htmlFor="change-phone-new"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  New mobile number
                </label>
                <div className="relative">
                  <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="change-phone-new"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    autoComplete="tel"
                    inputMode="tel"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="group inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending OTP…
                  </>
                ) : (
                  <>
                    Send OTP
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'enter-code' && (
            <form onSubmit={handleVerifyOtp} className="space-y-3" noValidate>
              <div>
                <label
                  htmlFor="change-phone-otp"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  6-digit code
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="change-phone-otp"
                    type="text"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                    }
                    placeholder="123456"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-base tracking-[0.4em] text-slate-800 placeholder-slate-400 transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="group inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  <>
                    Verify and update
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep('enter-phone');
                    setOtp('');
                    setError('');
                    setInfo('');
                  }}
                  className="font-semibold text-slate-500 transition hover:text-slate-700"
                >
                  Use a different number
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || resendIn > 0}
                  className="inline-flex items-center gap-1 font-semibold text-amber-700 transition hover:text-amber-800 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:text-slate-400"
                >
                  <RotateCcw size={12} />
                  {resending
                    ? 'Resending…'
                    : resendIn > 0
                      ? `Resend in ${fmtMmSs(resendIn)}`
                      : 'Resend code'}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}
