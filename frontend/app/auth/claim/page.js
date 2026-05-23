'use client';

// Client-invitation claim page.
// Reads ?token= from the URL, fetches the email/name attached to the invite,
// lets the user set a password (and optionally adjust their name), then logs
// them in via AuthProvider.claimAccount.

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import BrandLogo from '@/components/common/BrandLogo';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import { useAuth } from '@/components/AuthProvider';
import { getClaimInfo } from '@/services/authService';

function ClaimInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { claimAccount } = useAuth();
  const token = searchParams.get('token');

  // 'loading' | 'form' | 'invalid' | 'success'
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [info, setInfo] = useState(null);

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    if (!token) {
      setStatus('invalid');
      setErrorMessage(
        'This invitation link is missing its token. Please use the link from your email.'
      );
      return;
    }

    let active = true;
    (async () => {
      try {
        const data = await getClaimInfo(token);
        if (!active) return;
        setInfo(data);
        setFullName(data.name || '');
        setStatus('form');
      } catch (err) {
        if (!active) return;
        setStatus('invalid');
        setErrorMessage(
          (err && err.message) ||
            'This invitation link is invalid or has expired.'
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setFormError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await claimAccount({
        token,
        password,
        fullName: fullName.trim() || undefined,
      });
      setStatus('success');
      setTimeout(() => {
        router.replace('/dashboard/client');
      }, 1200);
    } catch (err) {
      setFormError(
        (err && err.message) ||
          'Could not claim your account. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <BrandLogo />
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto flex max-w-md flex-col items-stretch px-4 py-12 sm:px-6">
          {status === 'loading' && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
              <p className="mt-3 text-sm text-slate-600">
                Checking your invitation…
              </p>
            </div>
          )}

          {status === 'invalid' && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertCircle size={22} />
              </span>
              <h1 className="mt-3 text-lg font-semibold text-slate-900">
                Invitation unavailable
              </h1>
              <p className="mt-1 text-sm text-slate-500">{errorMessage}</p>
              <div className="mt-5 flex flex-col gap-2">
                <Button href="/login" variant="primary">
                  Sign in
                </Button>
                <Button href="/" variant="ghost">
                  Back to home
                </Button>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 size={22} />
              </span>
              <h1 className="mt-3 text-lg font-semibold text-slate-900">
                Welcome to Profirmo
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Your account is active. Taking you to your dashboard…
              </p>
            </div>
          )}

          {status === 'form' && info && (
            <form
              onSubmit={handleSubmit}
              className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Claim your account
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Set a password to activate your Profirmo client account.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <Mail size={16} className="text-slate-400" />
                <span className="truncate">{info.email}</span>
              </div>

              <Input
                label="Your name"
                name="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
              />

              <Input
                label="New password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />

              <Input
                label="Confirm password"
                name="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
              />

              {formError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
                className="w-full"
              >
                {submitting ? 'Activating…' : 'Activate account'}
              </Button>
              <p className="text-center text-xs text-slate-500">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-blue-600">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={null}>
      <ClaimInner />
    </Suspense>
  );
}
