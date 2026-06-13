'use client';

// /join-team/login — Employee login.
// Two modes via a toggle:
//   1. Password — identifier (email OR phone) + password.
//   2. OTP     — phone → send OTP → enter code.
// Only OTP-verified accounts may log in (server enforces).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAccessToken } from '@/services/api';
import {
  ArrowLeft,
  Mail,
  Phone,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import {
  employeeLogin,
  employeeSendLoginOtp,
  employeeVerifyLoginOtp,
  getEmployeeToken,
} from '@/services/employeeAuthService';

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

export default function EmployeeLoginPage() {
  const router = useRouter();

  // `checked` blocks the form from rendering until we've confirmed
  // there's no existing session. Without it the form briefly flashes
  // before the redirect fires — that's the visible "flicker".
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

  const [mode, setMode] = useState('password'); // 'password' | 'otp'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otpStage, setOtpStage] = useState('phone'); // 'phone' | 'verify'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function switchMode(next) {
    setMode(next);
    setError('');
    setNotice('');
    setOtpStage('phone');
    setOtp('');
  }

  async function submitPassword(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await employeeLogin({
        identifier: identifier.trim(),
        password,
      });
      router.push('/join-team/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  async function sendOtp(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await employeeSendLoginOtp(phone.trim());
      setOtpStage('verify');
      setNotice(`We've sent an OTP to ${phone}.`);
    } catch (err) {
      setError(err.message || 'Could not send OTP.');
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await employeeVerifyLoginOtp({
        phone: phone.trim(),
        code: otp.trim(),
      });
      router.push('/join-team/dashboard');
    } catch (err) {
      setError(err.message || 'Verification failed.');
    } finally {
      setBusy(false);
    }
  }

  // Pre-auth gate — render a blank shell while we check localStorage,
  // never the form, so the form can't flash before a redirect.
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
            Employee login
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Sign in to your employee dashboard to onboard professionals,
            view commission, and request payouts.
          </p>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {/* Mode toggle */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => switchMode('password')}
                className={`rounded-md px-3 py-1.5 transition ${
                  mode === 'password'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => switchMode('otp')}
                className={`rounded-md px-3 py-1.5 transition ${
                  mode === 'otp'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                OTP
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <Banner tone="error">{error}</Banner>
              <Banner tone="success">{notice}</Banner>
            </div>

            {mode === 'password' ? (
              <form onSubmit={submitPassword} className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Email or phone
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="you@example.com or +91 98xxxxxxxx"
                      className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
                </button>
              </form>
            ) : otpStage === 'phone' ? (
              <form onSubmit={sendOtp} className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Phone number
                  </label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98xxxxxxxx"
                      className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={submitOtp} className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">
                    OTP
                  </label>
                  <input
                    inputMode="numeric"
                    required
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))
                    }
                    placeholder="Enter the code"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm tracking-[0.4em] focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setOtpStage('phone')}
                    className="text-sm font-semibold text-slate-500 hover:text-slate-700"
                  >
                    ← Edit number
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & sign in'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <p className="mt-4 text-center text-sm text-slate-600">
            New here?{' '}
            <Link
              href="/join-team/signup"
              className="font-semibold text-amber-700 hover:underline"
            >
              Create an employee account
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
