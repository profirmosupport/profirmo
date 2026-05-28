'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Mail,
  Lock,
  Loader2,
  MailWarning,
  MailCheck,
  Clock,
} from 'lucide-react';
import BrandLogo from '@/components/common/BrandLogo';
import { useAuth } from '@/components/AuthProvider';
import { resendVerification } from '@/services/authService';
import { validateForm, loginRules } from '@/utils/validators';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, loading } = useAuth();
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

  // Already signed in — go straight to the dashboard.
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [loading, isAuthenticated, router]);

  function handleChange(e) {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  }

  function errorCode(err) {
    return (err && err.payload && err.payload.code) || '';
  }

  // Detect whether a failed login was a professional pending-approval block.
  function isPendingApprovalError(err) {
    if (!err) return false;
    if (errorCode(err) === 'PENDING_APPROVAL') return true;
    if (err.status === 403 && /under review|pending approval/i.test(err.message || ''))
      return true;
    return false;
  }

  // Detect whether a failed login was due to an unverified account.
  function isUnverifiedError(err) {
    if (!err) return false;
    if (errorCode(err) === 'EMAIL_NOT_VERIFIED') return true;
    if (err.status === 403 && /verif/i.test(err.message || '')) return true;
    // A bare 403 with no other classification — treat as unverified.
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
      router.push('/dashboard');
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
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Sign in to your Pro<span className="text-gradient"> Firmo</span>{' '}
              account.
            </p>
          </div>

          <div className="glass rounded-2xl border border-slate-200/80 p-6 shadow-card sm:p-7">
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
                      Please verify your email before signing in. We can send
                      you a fresh verification link.
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
                      Our team is verifying your details. You&apos;ll be emailed
                      once it&apos;s approved — no action is needed from you
                      right now.
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
                  <p className="mt-1 text-xs text-red-600">
                    {errors.password}
                  </p>
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
