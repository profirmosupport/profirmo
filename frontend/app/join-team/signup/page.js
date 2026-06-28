'use client';

// /join-team/signup — Employee module signup.
// Two-stage flow:
//   Stage 1: collect name / email / phone, accept T&C, POST → backend
//            sends OTP via SMS.
//   Stage 2: enter OTP + optional password. On success the backend
//            returns an access token; we drop the user on the
//            dashboard placeholder (Phase 2 wires the real page).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAccessToken } from '@/services/api';
import {
  ArrowLeft,
  Mail,
  Phone,
  User,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import {
  employeeSignup,
  employeeResendSignupOtp,
  employeeVerifySignupOtp,
  getEmployeeToken,
} from '@/services/employeeAuthService';

function FieldLabel({ children, htmlFor }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500"
    >
      {children}
    </label>
  );
}

function Banner({ tone, children }) {
  if (!children) return null;
  const isOk = tone === 'success';
  return (
    <div
      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
        isOk
          ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border border-red-200 bg-red-50 text-red-700'
      }`}
    >
      {isOk ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span>{children}</span>
    </div>
  );
}

export default function EmployeeSignupPage() {
  const router = useRouter();

  // Already authenticated → bounce away. `checked` guards the form
  // render so it can't flash before the redirect.
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (getEmployeeToken()) {
      router.replace('/join-team/dashboard');
      return;
    }
    if (getAccessToken()) {
      router.replace('/dashboard');
      return;
    }
    setChecked(true);
  }, [router]);

  const [stage, setStage] = useState('details');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submitDetails(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await employeeSignup({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        termsAccepted: terms,
      });
      setStage('otp');
      setNotice(`We've sent an OTP to ${phone}. Check your messages.`);
    } catch (err) {
      setError(err.message || 'Could not start signup.');
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await employeeVerifySignupOtp({
        phone: phone.trim(),
        code: otp.trim(),
        password: password ? password : undefined,
      });
      // Phase 1 — drop on the (placeholder) dashboard.
      router.push('/join-team/dashboard');
    } catch (err) {
      setError(err.message || 'OTP verification failed.');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await employeeResendSignupOtp(phone.trim());
      setNotice('A fresh OTP has been sent.');
    } catch (err) {
      setError(err.message || 'Could not resend OTP.');
    } finally {
      setBusy(false);
    }
  }

  // Skip rendering the form until we've confirmed there's no session —
  // prevents the brief flash before a redirect kicks in.
  if (!checked) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-md px-4 py-12 sm:px-6 lg:px-8">
          <Link
            href="/join-team"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={14} />
            Back to overview
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            Employee sign up
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Field agents who onboard professionals to Profirmo.
          </p>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Banner tone="error">{error}</Banner>
            <Banner tone="success">{notice}</Banner>

            {stage === 'details' ? (
              <form onSubmit={submitDetails} className="mt-4 space-y-4">
                <div>
                  <FieldLabel htmlFor="name">Full name</FieldLabel>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Aarav Mehta"
                      className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel htmlFor="phone">Phone number</FieldLabel>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="phone"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98xxxxxxxx"
                      className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    This becomes your employee code — used on every
                    professional you onboard.
                  </p>
                </div>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    required
                    checked={terms}
                    onChange={(e) => setTerms(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    I agree to the{' '}
                    <Link
                      href="/join-team/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-amber-700 hover:underline"
                    >
                      Employee Terms &amp; Conditions
                    </Link>{' '}
                    and{' '}
                    <Link
                      href="/join-team/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-amber-700 hover:underline"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={busy || !terms}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Send OTP'
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={submitOtp} className="mt-4 space-y-4">
                <div>
                  <FieldLabel htmlFor="otp">OTP</FieldLabel>
                  <input
                    id="otp"
                    inputMode="numeric"
                    required
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))
                    }
                    placeholder="Enter the code you received"
                    className="w-full rounded-lg border border-slate-300 py-2.5 px-3 text-sm tracking-[0.4em] focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="password">
                    Set password (optional)
                  </FieldLabel>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="password"
                      type="password"
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Skip this and you&apos;ll log in via OTP each time.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={resend}
                    disabled={busy}
                    className="text-sm font-semibold text-amber-700 hover:text-amber-800 disabled:opacity-60"
                  >
                    Resend OTP
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Verify & continue'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          <p className="mt-4 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link
              href="/join-team/login"
              className="font-semibold text-amber-700 hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
