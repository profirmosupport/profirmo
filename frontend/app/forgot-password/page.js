'use client';

// Forgot-password — step 1 of the OTP password-reset flow.
// Collects an account identifier (email OR phone), asks the backend to send a
// verification code via the matching channel, stashes the identifier in
// sessionStorage and hands off to /verify-password-otp.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  AtSign,
  Loader2,
  MailCheck,
  ArrowLeft,
} from 'lucide-react';
import BrandLogo from '@/components/common/BrandLogo';
import { useAuth } from '@/components/AuthProvider';
import { forgotPassword } from '@/services/authService';
import { isEmail, isPhone } from '@/utils/validators';

// sessionStorage key shared with /verify-password-otp.
const RESET_IDENTIFIER_KEY = 'pf_reset_identifier';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [banner, setBanner] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already signed in — no need to reset a password.
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [loading, isAuthenticated, router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBanner('');
    setNotice('');

    const trimmed = identifier.trim();
    if (!trimmed) {
      setError('Email or phone is required.');
      return;
    }
    if (!isEmail(trimmed) && !isPhone(trimmed)) {
      setError('Enter a valid email or 10-digit mobile number.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await forgotPassword(trimmed);
      // Stash the identifier for the OTP-verification step (NOT in the URL).
      try {
        window.sessionStorage.setItem(RESET_IDENTIFIER_KEY, trimmed);
      } catch {
        /* storage unavailable — ignore */
      }
      setNotice(
        (data && data.message) ||
          'If an account exists for the email or phone you entered, a verification code has been sent.'
      );
      // Briefly show the confirmation, then advance to the OTP step.
      setTimeout(() => {
        router.push('/verify-password-otp');
      }, 1200);
    } catch (err) {
      setBanner(
        (err && err.message) ||
          'Unable to send the verification code. Please try again.'
      );
      setSubmitting(false);
    }
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
              Forgot your password?
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Enter your email or mobile number and we&apos;ll send you a
              6-digit verification code to reset it.
            </p>
          </div>

          <div className="glass rounded-2xl border border-slate-200/80 p-6 shadow-card sm:p-7">
            {banner && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{banner}</span>
              </div>
            )}

            {notice && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm text-teal-700">
                <MailCheck size={16} className="mt-0.5 shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="identifier"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Email or mobile number
                </label>
                <div className="relative">
                  <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="identifier"
                    name="identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setError('');
                    }}
                    placeholder="you@example.com or 98xxxxxxxx"
                    autoComplete="username"
                    disabled={submitting}
                    className={`w-full rounded-lg border bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 transition focus:outline-none focus:ring-2 disabled:bg-slate-50 ${
                      error
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                        : 'border-slate-300 focus:border-amber-500 focus:ring-amber-200'
                    }`}
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  We&apos;ll send the OTP via email if you enter an email, or
                  via SMS if you enter a phone number.
                </p>
                {error && (
                  <p className="mt-1 text-xs text-red-600">{error}</p>
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
                    Sending code…
                  </>
                ) : (
                  <>
                    Send verification code
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 font-semibold text-amber-700 hover:text-amber-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
