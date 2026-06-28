'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Mail,
  Lock,
  Loader2,
  MailWarning,
  MailCheck,
  Clock,
  Smartphone,
  KeyRound,
  RotateCcw,
} from 'lucide-react';
import BrandLogo from '@/components/common/BrandLogo';
import { useAuth } from '@/components/AuthProvider';
import {
  resendVerification,
  checkPhone,
  sendPhoneOtp,
  verifyPhoneOtp,
} from '@/services/authService';
import { validateForm, loginRules } from '@/utils/validators';

// Five minutes between an OTP send and the next allowed Resend. Matches the
// product spec.
const RESEND_COOLDOWN_SECONDS = 300;

// Only same-origin paths are honoured as a post-login redirect target — the
// `next` query param could otherwise be used to redirect users to a phishing
// site. We require a leading "/" and reject "//" (protocol-relative URLs).
function safeNext(raw) {
  if (typeof raw !== 'string') return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  return raw;
}

// --- Phone tab -------------------------------------------------------------

function PhoneTab({ onAuthenticated, nextPath }) {
  const router = useRouter();
  const { loginWithPhone } = useAuth();

  // Two-step state: 'enter-phone' -> 'enter-code'
  const [step, setStep] = useState('enter-phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  // The E.164-normalised phone we sent the OTP to. Used as the stable
  // identifier for verify + login (the user might edit `phone` after we
  // sent the code; we always verify against the original target).
  const [sentTo, setSentTo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  // Tracks "phone is not registered" separately so the UI can render a
  // signup CTA instead of a plain error banner.
  const [unregistered, setUnregistered] = useState(false);
  // Seconds remaining until the Resend button becomes active again.
  // Counts down from RESEND_COOLDOWN_SECONDS after each successful send.
  const [resendIn, setResendIn] = useState(0);

  // Resend cooldown ticker. Runs only while the timer is positive.
  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setInterval(() => {
      setResendIn((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  function toE164(raw) {
    // Strip everything that isn't a digit or leading +. Default to +91 when
    // the user typed a 10-digit Indian number with no country code.
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

  async function handleSendOtp(e) {
    e && e.preventDefault();
    setError('');
    setInfo('');
    setUnregistered(false);
    const e164 = toE164(phone);
    if (!/^\+\d{8,15}$/.test(e164)) {
      setError('Enter a valid phone number including the country code.');
      return;
    }
    setSubmitting(true);
    try {
      // Existence check BEFORE burning an SMS. Avoids any UX confusion
      // where an unregistered user receives an OTP they then can't redeem.
      const check = await checkPhone(e164);
      if (!check || !check.exists) {
        setUnregistered(true);
        return;
      }
      await sendPhoneOtp(e164, 'login');
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
      // Step 1: verify the OTP server-side. Sets a verified flag on the
      // OTP row that the next call redeems.
      await verifyPhoneOtp(sentTo, 'login', otp.trim());
      // Step 2: redeem the verified flag to mint a session.
      await loginWithPhone(sentTo);
      onAuthenticated && onAuthenticated();
      // Use replace so the user can't back-button into the login page,
      // and DON'T clear `submitting` — the loader stays visible until the
      // component unmounts at the destination route. Without this the
      // spinner blinks off and the button "Verify and sign in" briefly
      // re-appears between the auth state flip and the navigation
      // committing.
      router.replace(nextPath);
      return;
    } catch (err) {
      const code = err && err.payload && err.payload.code;
      setError(
        (err && err.message) ||
          (code === 'OTP_INCORRECT'
            ? 'The code you entered is incorrect.'
            : 'Could not verify the code. It may be wrong or expired.')
      );
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
      await sendPhoneOtp(target, 'login');
      setSentTo(target);
      setInfo(`A new 6-digit code was sent to ${target}.`);
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(
        (err && err.message) || 'Could not resend the OTP. Please try again.'
      );
    } finally {
      setResending(false);
    }
  }

  // mm:ss formatting for the cooldown badge.
  function fmtMmSs(totalSec) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  return (
    <div>
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm text-teal-800">
          <MailCheck size={16} className="mt-0.5 shrink-0" />
          <span>{info}</span>
        </div>
      )}
      {unregistered && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
          <div className="flex items-start gap-2 text-amber-800">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">No account found for this number.</p>
              <p className="mt-0.5 text-amber-700">
                Sign up first to create an account with this phone number.
              </p>
            </div>
          </div>
          <Link
            href={`/signup?phone=${encodeURIComponent(phone)}`}
            className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
          >
            Create an account
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {step === 'enter-phone' && (
        <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="phone"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Mobile number
            </label>
            <div className="relative">
              <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                autoComplete="tel"
                inputMode="tel"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Indian numbers default to +91. You will receive a 6-digit OTP by
              SMS.
            </p>
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
        <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="otp"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              6-digit code
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="otp"
                name="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="123456"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                disabled={submitting}
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-base tracking-[0.4em] text-slate-800 placeholder-slate-400 transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-50"
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
                Verify and sign in
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setStep('enter-phone');
                setOtp('');
                setError('');
                setInfo('');
              }}
              className="font-semibold text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Use a different number
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={submitting || resending || resendIn > 0}
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
  );
}

// --- Email tab (existing email/password flow, unchanged behaviour) ---------

function EmailTab({ nextPath }) {
  const router = useRouter();
  const { login } = useAuth();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Distinct state for an unverified-account login attempt.
  const [unverified, setUnverified] = useState(false);
  // Distinct state for a professional whose application is under review.
  const [pendingApproval, setPendingApproval] = useState(false);
  const [resendNotice, setResendNotice] = useState('');
  const [resendError, setResendError] = useState('');
  const [resending, setResending] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  }

  function errorCode(err) {
    return (err && err.payload && err.payload.code) || '';
  }

  function isPendingApprovalError(err) {
    if (!err) return false;
    if (errorCode(err) === 'PENDING_APPROVAL') return true;
    if (err.status === 403 && /under review|pending approval/i.test(err.message || ''))
      return true;
    return false;
  }

  function isUnverifiedError(err) {
    if (!err) return false;
    if (errorCode(err) === 'EMAIL_NOT_VERIFIED') return true;
    if (err.status === 403 && /verif/i.test(err.message || '')) return true;
    if (err.status === 403 && !isPendingApprovalError(err)) return true;
    return /verif/i.test(err.message || '');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBanner('');
    setUnverified(false);
    setPendingApproval(false);
    setResendNotice('');
    setResendError('');
    const { valid, errors: errs } = validateForm(values, loginRules);
    setErrors(errs);
    if (!valid) return;

    setSubmitting(true);
    try {
      await login(values.email.trim(), values.password);
      router.push(nextPath);
    } catch (err) {
      if (isPendingApprovalError(err)) {
        setPendingApproval(true);
      } else if (isUnverifiedError(err)) {
        setUnverified(true);
      } else {
        setBanner(
          (err && err.message) || 'Unable to sign in. Please try again.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resending) return;
    setResendError('');
    setResendNotice('');
    const email = values.email.trim();
    if (!email) {
      setResendError('Enter your email address above first.');
      return;
    }
    setResending(true);
    try {
      const res = await resendVerification(email);
      setResendNotice(
        (res && res.message) || 'Verification email sent. Check your inbox.'
      );
    } catch (err) {
      setResendError(
        (err && err.message) || 'Unable to resend the email. Please try again.'
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      {banner && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      {unverified && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
          <div className="flex items-start gap-2 text-amber-800">
            <MailWarning size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">
                Your email isn&apos;t verified yet.
              </p>
              <p className="mt-0.5 text-amber-700">
                Please verify your email before signing in. We can send you a
                fresh verification link.
              </p>
            </div>
          </div>

          {resendNotice && (
            <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-2 text-teal-700">
              <MailCheck size={15} className="mt-0.5 shrink-0" />
              <span>{resendNotice}</span>
            </div>
          )}
          {resendError && (
            <p className="mt-2 text-xs text-red-600">{resendError}</p>
          )}

          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              'Resend verification email'
            )}
          </button>
        </div>
      )}

      {pendingApproval && (
        <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-3 py-3 text-sm">
          <div className="flex items-start gap-2 text-teal-800">
            <Clock size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">
                Your professional application is under review.
              </p>
              <p className="mt-0.5 text-teal-700">
                Our team is verifying your details. You&apos;ll be emailed once
                it&apos;s approved — no action is needed from you right now.
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Email address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              name="email"
              type="email"
              value={values.email}
              onChange={handleChange}
              placeholder="you@example.com"
              autoComplete="email"
              className={`w-full rounded-lg border bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 transition focus:outline-none focus:ring-2 ${
                errors.email
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-300 focus:border-amber-500 focus:ring-amber-200'
              }`}
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email}</p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-amber-700 transition hover:text-amber-800"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              name="password"
              type="password"
              value={values.password}
              onChange={handleChange}
              placeholder="Your password"
              autoComplete="current-password"
              className={`w-full rounded-lg border bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 transition focus:outline-none focus:ring-2 ${
                errors.password
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-300 focus:border-amber-500 focus:ring-amber-200'
              }`}
            />
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="group inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>
    </>
  );
}

// --- Page shell ------------------------------------------------------------

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNext(searchParams.get('next')) || '/dashboard';
  const { isAuthenticated, loading } = useAuth();
  const [tab, setTab] = useState('phone'); // 'phone' | 'email'

  // Already signed in — go straight to the post-login destination.
  // Regular user → respect `next=` query param (or /dashboard fallback).
  // Employee session → bounce to the employee dashboard so the
  // /join-team flow doesn't collide with a parallel platform login.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Check the employee token synchronously since the User-level
    // AuthProvider doesn't know about it.
    try {
      const empToken = window.localStorage.getItem('pf.employee.access');
      if (empToken) {
        router.replace('/join-team/dashboard');
        return;
      }
    } catch {
      /* localStorage unavailable — fall through */
    }
    if (!loading && isAuthenticated) {
      router.replace(nextPath);
    }
  }, [loading, isAuthenticated, router, nextPath]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-amber-50 via-white to-teal-50">
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
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Sign in to your Pro<span className="text-gradient"> Firmo</span>{' '}
              account.
            </p>
          </div>

          <div className="glass rounded-2xl border border-slate-200/80 p-6 shadow-card sm:p-7">
            {/* Tab toggle */}
            <div
              className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold"
              role="tablist"
              aria-label="Sign-in method"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'phone'}
                onClick={() => setTab('phone')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition ${
                  tab === 'phone'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Smartphone size={14} />
                Phone OTP
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'email'}
                onClick={() => setTab('email')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition ${
                  tab === 'email'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Mail size={14} />
                Email
              </button>
            </div>

            {tab === 'phone' ? (
              <PhoneTab nextPath={nextPath} />
            ) : (
              <EmailTab nextPath={nextPath} />
            )}
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            New to Pro Firmo?{' '}
            <Link
              href="/signup"
              className="font-semibold text-amber-700 hover:text-amber-800"
            >
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
