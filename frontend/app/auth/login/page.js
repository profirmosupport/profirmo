'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Scale, AlertCircle } from 'lucide-react';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import { useAuth } from '@/hooks/useAuth';
import { validateForm, loginRules } from '@/utils/validators';
import { ROLES, SITE } from '@/utils/constants';

const ROLE_ROUTES = {
  [ROLES.CLIENT]: '/dashboard/client',
  [ROLES.PROFESSIONAL]: '/dashboard/professional',
  [ROLES.FIRM_PROFESSIONAL]: '/dashboard/professional',
  [ROLES.FIRM_ADMIN]: '/dashboard/firm',
  [ROLES.PLATFORM_ADMIN]: '/dashboard/admin',
};

const DEMO_ACCOUNTS = [
  { label: 'Client', email: 'client@demo.com' },
  { label: 'Professional', email: 'pro@demo.com' },
  { label: 'Firm admin', email: 'firmadmin@demo.com' },
  { label: 'Platform admin', email: 'admin@demo.com' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  }

  function fillDemo(email) {
    setValues({ email, password: 'password123' });
    setErrors({});
    setBanner('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBanner('');
    const { valid, errors: errs } = validateForm(values, loginRules);
    setErrors(errs);
    if (!valid) return;

    setSubmitting(true);
    try {
      const res = await login(values.email, values.password);
      const role = res && res.user ? res.user.role : undefined;
      router.push(ROLE_ROUTES[role] || '/dashboard/client');
    } catch (err) {
      setBanner(
        (err && err.message) ||
          'Unable to sign in right now. Please check your credentials and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Scale size={18} />
            </span>
            <span className="text-lg font-bold text-slate-900">
              {SITE.name}
            </span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-500">
              Sign in to your {SITE.name} account.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {banner && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{banner}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Input
                label="Email address"
                name="email"
                type="email"
                value={values.email}
                onChange={handleChange}
                placeholder="you@example.com"
                error={errors.email}
                required
              />
              <Input
                label="Password"
                name="password"
                type="password"
                value={values.password}
                onChange={handleChange}
                placeholder="Enter your password"
                error={errors.password}
                required
              />
              <Button
                type="submit"
                className="w-full"
                disabled={submitting}
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Demo accounts
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Password for all:{' '}
                <span className="font-mono font-medium text-slate-700">
                  password123
                </span>
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillDemo(acc.email)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs transition-colors hover:border-blue-300 hover:bg-blue-50"
                  >
                    <span className="block font-medium text-slate-700">
                      {acc.label}
                    </span>
                    <span className="block text-slate-500">{acc.email}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-slate-600">
            <p>
              New to {SITE.name}? Create an account as a{' '}
              <Link
                href="/auth/register-client"
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                client
              </Link>
              ,{' '}
              <Link
                href="/auth/register-professional"
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                professional
              </Link>{' '}
              or{' '}
              <Link
                href="/auth/register-firm"
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                firm
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
