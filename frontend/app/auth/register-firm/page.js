'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Scale, AlertCircle } from 'lucide-react';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import { useAuth } from '@/hooks/useAuth';
import { validateForm, firmRegisterRules } from '@/utils/validators';
import { CITIES, FIRM_TYPES, SITE } from '@/utils/constants';

const cityOptions = CITIES.map((c) => ({ value: c, label: c }));
const firmTypeOptions = FIRM_TYPES.map((t) => ({ value: t, label: t }));

function SectionHeading({ children }) {
  return (
    <h2 className="border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h2>
  );
}

export default function RegisterFirmPage() {
  const router = useRouter();
  const { registerFirm } = useAuth();
  const [values, setValues] = useState({
    name: '',
    firmType: '',
    adminName: '',
    email: '',
    phone: '',
    password: '',
    city: '',
    address: '',
    services: '',
    professionalCount: '',
    description: '',
  });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBanner('');
    const { valid, errors: errs } = validateForm(values, firmRegisterRules);
    setErrors(errs);
    if (!valid) return;

    setSubmitting(true);
    try {
      await registerFirm({
        ...values,
        professionalCount: Number(values.professionalCount) || 0,
        services: values.services
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      router.push('/dashboard/firm');
    } catch (err) {
      setBanner(
        (err && err.message) ||
          'We could not create your firm account right now. Please try again shortly.'
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
        <div className="w-full max-w-2xl">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-slate-900">
              Register your firm
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Bring your team onto {SITE.name} and manage clients in one place.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {banner && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{banner}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              <div className="space-y-4">
                <SectionHeading>Firm details</SectionHeading>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Firm name"
                    name="name"
                    value={values.name}
                    onChange={handleChange}
                    placeholder="e.g. Mehta & Associates"
                    error={errors.name}
                    required
                  />
                  <Select
                    label="Firm type"
                    name="firmType"
                    value={values.firmType}
                    onChange={handleChange}
                    options={firmTypeOptions}
                    placeholder="Select firm type"
                    error={errors.firmType}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Select
                    label="City"
                    name="city"
                    value={values.city}
                    onChange={handleChange}
                    options={cityOptions}
                    placeholder="Select city"
                    error={errors.city}
                    required
                  />
                  <Input
                    label="Number of professionals"
                    name="professionalCount"
                    type="number"
                    value={values.professionalCount}
                    onChange={handleChange}
                    placeholder="e.g. 5"
                    error={errors.professionalCount}
                    min="0"
                  />
                </div>
                <Input
                  label="Office address"
                  name="address"
                  value={values.address}
                  onChange={handleChange}
                  placeholder="Street, area, city, state, PIN"
                  error={errors.address}
                  required
                />
                <div className="w-full">
                  <label
                    htmlFor="services"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Services offered
                  </label>
                  <textarea
                    id="services"
                    name="services"
                    rows={3}
                    value={values.services}
                    onChange={handleChange}
                    placeholder="Family law, Corporate advisory, Tax planning"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Enter services separated by commas.
                  </p>
                </div>
                <div className="w-full">
                  <label
                    htmlFor="description"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Firm description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    value={values.description}
                    onChange={handleChange}
                    placeholder="Tell clients about your firm, its strengths and areas of practice."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <SectionHeading>Administrator account</SectionHeading>
                <Input
                  label="Admin full name"
                  name="adminName"
                  value={values.adminName}
                  onChange={handleChange}
                  placeholder="Account administrator name"
                  error={errors.adminName}
                  required
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Email address"
                    name="email"
                    type="email"
                    value={values.email}
                    onChange={handleChange}
                    placeholder="admin@firm.com"
                    error={errors.email}
                    required
                  />
                  <Input
                    label="Phone number"
                    name="phone"
                    value={values.phone}
                    onChange={handleChange}
                    placeholder="10-digit mobile"
                    error={errors.phone}
                    required
                  />
                </div>
                <Input
                  label="Password"
                  name="password"
                  type="password"
                  value={values.password}
                  onChange={handleChange}
                  placeholder="Min. 8 characters"
                  error={errors.password}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Creating account…' : 'Register firm'}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link
              href="/auth/login"
              className="font-medium text-blue-600 hover:text-blue-700"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
