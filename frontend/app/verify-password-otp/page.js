'use client';

// Verify-password-OTP — step 2 of the OTP password-reset flow.
// Reads pf_reset_identifier (email OR phone) from sessionStorage, collects
// the 6-digit code with a 10-minute validity countdown + a 60-second resend
// cooldown, then stores the returned resetToken and hands off to
// /reset-password.

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Clock,
  RefreshCw,
  Phone,
} from 'lucide-react';
import BrandLogo from '@/components/common/BrandLogo';
import { verifyPasswordOtp, resendOtp } from '@/services/authService';
import { isEmail } from '@/utils/validators';

// sessionStorage keys shared across the reset flow.
const RESET_IDENTIFIER_KEY = 'pf_reset_identifier';
const RESET_TOKEN_KEY = 'pf_reset_token';

const OTP_LENGTH = 6;
const OTP_VALIDITY_SECONDS = 10 * 60; // 10:00 — the OTP validity window.
const RESEND_COOLDOWN_SECONDS = 60; // first-resend cooldown.

/** Format a seconds count as M:SS. */
function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function clearResetStorage() {
  try {
    window.sessionStorage.removeItem(RESET_IDENTIFIER_KEY);
    window.sessionStorage.removeItem(RESET_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export default function VerifyPasswordOtpPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const identifierIsEmail = identifier && isEmail(identifier);
  const [ready, setReady] = useState(false);

  // Six single-character boxes.
  const [digits, setDigits] = useState(() => Array(OTP_LENGTH).fill(''));
  const inputsRef = useRef([]);

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);
  const [exceeded, setExceeded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Countdown timers.
  const [validitySeconds, setValiditySeconds] = useState(OTP_VALIDITY_SECONDS);
  const [resendSeconds, setResendSeconds] = useState(RESEND_COOLDOWN_SECONDS);
  const [resendCount, setResendCount] = useState(0);
  const [resending, setResending] = useState(false);
  const [phoneResending, setPhoneResending] = useState(false);

  const expired = validitySeconds <= 0;

  // On mount: require pf_reset_identifier, else bounce to step 1.
  useEffect(() => {
    let stored = '';
    try {
      stored = window.sessionStorage.getItem(RESET_IDENTIFIER_KEY) || '';
    } catch {
      stored = '';
    }
    if (!stored) {
      router.replace('/forgot-password');
      return;
    }
    setIdentifier(stored);
    setReady(true);
  }, [router]);

  // 10-minute OTP-validity countdown.
  useEffect(() => {
    if (!ready) return undefined;
    const id = setInterval(() => {
      setValiditySeconds((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [ready]);

  // 60-second resend cooldown countdown.
  useEffect(() => {
    if (!ready) return undefined;
    if (resendSeconds <= 0) return undefined;
    const id = setInterval(() => {
      setResendSeconds((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [ready, resendSeconds]);

  const otp = digits.join('');
  const otpComplete = otp.length === OTP_LENGTH && /^\d{6}$/.test(otp);

  const focusInput = useCallback((index) => {
    const el = inputsRef.current[index];
    if (el) el.focus();
  }, []);

  function resetMessages() {
    setError('');
    setInfo('');
  }

  function handleDigitChange(index, rawValue) {
    resetMessages();
    const value = rawValue.replace(/\D/g, '');
    if (!value) {
      // Cleared this box.
      setDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }
    // If multiple digits arrived (e.g. fast typing), spread them forward.
    setDigits((prev) => {
      const next = [...prev];
      let cursor = index;
      for (const ch of value) {
        if (cursor >= OTP_LENGTH) break;
        next[cursor] = ch;
        cursor += 1;
      }
      // Move focus to the next empty box (or the last one).
      const focusTarget = Math.min(cursor, OTP_LENGTH - 1);
      requestAnimationFrame(() => focusInput(focusTarget));
      return next;
    });
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        // Clear current box only.
        setDigits((prev) => {
          const next = [...prev];
          next[index] = '';
          return next;
        });
      } else if (index > 0) {
        // Empty box — step back and clear the previous one.
        setDigits((prev) => {
          const next = [...prev];
          next[index - 1] = '';
          return next;
        });
        focusInput(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      focusInput(index + 1);
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const text = (e.clipboardData.getData('text') || '')
      .replace(/\D/g, '')
      .slice(0, OTP_LENGTH);
    if (!text) return;
    resetMessages();
    const next = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < text.length; i += 1) next[i] = text[i];
    setDigits(next);
    const focusTarget = Math.min(text.length, OTP_LENGTH - 1);
    requestAnimationFrame(() => focusInput(focusTarget));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    resetMessages();

    if (exceeded) return;
    if (expired) {
      setError('This code has expired. Please request a new one.');
      return;
    }
    if (!otpComplete) {
      setError('Enter the 6-digit code from your email.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await verifyPasswordOtp(identifier, otp);
      const resetToken = data && data.resetToken;
      if (!resetToken) {
        setError('Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }
      try {
        window.sessionStorage.setItem(RESET_TOKEN_KEY, resetToken);
      } catch {
        /* ignore */
      }
      router.push('/reset-password');
    } catch (err) {
      const code = (err && err.payload && err.payload.code) || '';
      const remaining =
        err && err.payload && err.payload.data
          ? err.payload.data.attemptsRemaining
          : undefined;

      if (code === 'OTP_ATTEMPTS_EXCEEDED') {
        setExceeded(true);
        setError(
          (err && err.message) ||
            'Too many incorrect attempts. Please restart the password reset.'
        );
      } else if (code === 'OTP_INCORRECT') {
        if (typeof remaining === 'number') setAttemptsRemaining(remaining);
        setError(
          (err && err.message) || 'That code is incorrect. Please try again.'
        );
      } else if (code === 'OTP_INVALID') {
        setError(
          (err && err.message) ||
            'This code has expired or is invalid. Request a new one below.'
        );
      } else {
        setError(
          (err && err.message) || 'Unable to verify the code. Please try again.'
        );
      }
      setSubmitting(false);
    }
  }

  async function handleResend(channel) {
    const inFlight = channel === 'phone' ? phoneResending : resending;
    if (inFlight || resendSeconds > 0) return;
    resetMessages();
    if (channel === 'phone') setPhoneResending(true);
    else setResending(true);
    try {
      const data = await resendOtp(identifier, channel === 'phone' ? { channel: 'phone' } : {});
      // Fresh code — reset both countdowns and clear stale entry.
      setValiditySeconds(OTP_VALIDITY_SECONDS);
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
      setResendCount((c) => c + 1);
      setDigits(Array(OTP_LENGTH).fill(''));
      setAttemptsRemaining(null);
      setExceeded(false);
      setInfo(
        (data && data.message) ||
          (channel === 'phone'
            ? 'A new verification code has been sent via SMS.'
            : 'A new verification code has been sent.')
      );
    } catch (err) {
      if (err && err.status === 429) {
        // Cooldown or 5-resend cap reached.
        setError(
          (err && err.message) ||
            'Please wait before requesting another code.'
        );
      } else {
        setError(
          (err && err.message) ||
            'Unable to resend the code. Please try again.'
        );
      }
    } finally {
      if (channel === 'phone') setPhoneResending(false);
      else setResending(false);
    }
  }

  function handleRestart() {
    clearResetStorage();
    router.push('/forgot-password');
  }

  // Avoid a flash of content before the storage guard resolves.
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-white to-teal-50">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-amber-50 via-white to-teal-50">
      {/* Slim branded top bar */}
      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <BrandLogo variant="light" />
          <Link
            href="/"
            className="text-sm font-medium text-slate-500 transition hover:text-teal-700"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Enter verification code
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              We sent a 6-digit code to{' '}
              <span className="font-semibold text-slate-700">{identifier}</span>
              {identifierIsEmail ? ' (check your email).' : ' (via SMS).'}
            </p>
          </div>

          <div className="glass rounded-2xl border border-slate-200/80 p-6 shadow-card sm:p-7">
            {/* Validity countdown */}
            <div
              className={`mb-4 flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium ${
                expired
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-teal-200 bg-teal-50 text-teal-700'
              }`}
            >
              <Clock size={15} className="shrink-0" />
              {expired ? (
                <span>Code expired — request a new one below.</span>
              ) : (
                <span>
                  Code expires in{' '}
                  <span className="font-mono font-semibold tabular-nums">
                    {formatTime(validitySeconds)}
                  </span>
                </span>
              )}
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {info && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm text-teal-700">
                <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                <span>{info}</span>
              </div>
            )}

            {attemptsRemaining !== null && !exceeded && (
              <p className="mb-4 text-center text-xs font-medium text-amber-700">
                {attemptsRemaining}{' '}
                {attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining
              </p>
            )}

            {exceeded ? (
              <div className="text-center">
                <p className="text-sm text-slate-600">
                  For your security this reset has been locked. Please start
                  over to receive a new code.
                </p>
                <button
                  type="button"
                  onClick={handleRestart}
                  className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:shadow-glow"
                >
                  Restart password reset
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div>
                  <label className="mb-2 block text-center text-sm font-medium text-slate-700">
                    6-digit code
                  </label>
                  <div
                    className="flex items-center justify-center gap-2"
                    onPaste={handlePaste}
                  >
                    {digits.map((digit, index) => (
                      <input
                        // eslint-disable-next-line react/no-array-index-key
                        key={index}
                        ref={(el) => {
                          inputsRef.current[index] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={1}
                        value={digit}
                        disabled={submitting || expired}
                        onChange={(e) =>
                          handleDigitChange(index, e.target.value)
                        }
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        aria-label={`Digit ${index + 1}`}
                        className={`h-12 w-11 rounded-lg border bg-white text-center text-lg font-semibold text-slate-800 transition focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 sm:h-14 sm:w-12 ${
                          error
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                            : 'border-slate-300 focus:border-amber-500 focus:ring-amber-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !otpComplete || expired}
                  className="group inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    <>
                      Verify code
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Resend code */}
            {!exceeded && (
              <div className="mt-5 border-t border-slate-200/70 pt-4 text-center">
                <p className="text-xs text-slate-500">
                  Didn&apos;t receive the code?
                </p>
                <button
                  type="button"
                  onClick={() => handleResend()}
                  disabled={resending || phoneResending || resendSeconds > 0}
                  className="mt-1.5 inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-amber-700 transition hover:text-amber-800 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {resending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : resendSeconds > 0 ? (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Resend in {formatTime(resendSeconds)}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Resend code
                    </>
                  )}
                </button>

                {/* Phone fallback — only shown when the user submitted an
                    email. They can request the same OTP via SMS instead. */}
                {identifierIsEmail && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => handleResend('phone')}
                      disabled={
                        resending || phoneResending || resendSeconds > 0
                      }
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-teal-700 transition hover:text-teal-800 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      {phoneResending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Sending SMS…
                        </>
                      ) : (
                        <>
                          <Phone className="h-3.5 w-3.5" />
                          Send OTP to phone instead
                        </>
                      )}
                    </button>
                  </div>
                )}

                {resendCount > 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    Code resent {resendCount}{' '}
                    {resendCount === 1 ? 'time' : 'times'}
                  </p>
                )}
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            Entered the wrong {identifierIsEmail ? 'email' : 'phone number'}?{' '}
            <button
              type="button"
              onClick={handleRestart}
              className="font-semibold text-amber-700 hover:text-amber-800"
            >
              Start over
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
