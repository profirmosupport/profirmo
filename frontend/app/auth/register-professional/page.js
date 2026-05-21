'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Scale, AlertCircle, UploadCloud } from 'lucide-react';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import { useAuth } from '@/hooks/useAuth';
import { validateForm, professionalRegisterRules } from '@/utils/validators';
import {
  CITIES,
  PROFESSION_TYPES,
  SPECIALIZATIONS,
  SITE,
} from '@/utils/constants';

const cityOptions = CITIES.map((c) => ({ value: c, label: c }));
const professionOptions = PROFESSION_TYPES.map((p) => ({
  value: p,
  label: p,
}));
const specializationOptions = SPECIALIZATIONS.map((s) => ({
  value: s,
  label: s,
}));

function SectionHeading({ children }) {
  return (
    <h2 className="border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h2>
  );
}

export default function RegisterProfessionalPage() {
  const router = useRouter();
  const { registerProfessional } = useAuth();
  const [values, setValues] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    professionType: '',
    specialization: '',
    experience: '',
    city: '',
    languages: '',
    perMinuteRate: '',
    bio: '',
    registrationNumber: '',
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
    const { valid, errors: errs } = validateForm(
      values,
      professionalRegisterRules
    );
    setErrors(errs);
    if (!valid) return;

    setSubmitting(true);
    try {
      await registerProfessional({
        ...values,
        experience: Number(values.experience) || 0,
        perMinuteRate: Number(values.perMinuteRate) || 0,
        languages: values.languages
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
      });
      router.push('/dashboard/professional');
    } catch (err) {
      setBanner(
        (err && err.message) ||
          'We could not create your account right now. Please try again shortly.'
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
              Join as a professional
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Create your profile and start accepting online consultations.
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
                <SectionHeading>Personal details</SectionHeading>
                <Input
                  label="Full name"
                  name="name"
                  value={values.name}
                  onChange={handleChange}
                  placeholder="Your full name"
                  error={errors.name}
                  required
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    label="Phone number"
                    name="phone"
                    value={values.phone}
                    onChange={handleChange}
                    placeholder="10-digit mobile"
                    error={errors.phone}
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
                    placeholder="Select your city"
                    error={errors.city}
                    required
                  />
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
              </div>

              <div className="space-y-4">
                <SectionHeading>Professional profile</SectionHeading>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Select
                    label="Profession type"
                    name="professionType"
                    value={values.professionType}
                    onChange={handleChange}
                    options={professionOptions}
                    placeholder="Select profession"
                    error={errors.professionType}
                    required
                  />
                  <Select
                    label="Specialization"
                    name="specialization"
                    value={values.specialization}
                    onChange={handleChange}
                    options={specializationOptions}
                    placeholder="Select specialization"
                    error={errors.specialization}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Years of experience"
                    name="experience"
                    type="number"
                    value={values.experience}
                    onChange={handleChange}
                    placeholder="e.g. 8"
                    error={errors.experience}
                    min="0"
                  />
                  <Input
                    label="Per-minute rate (₹)"
                    name="perMinuteRate"
                    type="number"
                    value={values.perMinuteRate}
                    onChange={handleChange}
                    placeholder="e.g. 50"
                    error={errors.perMinuteRate}
                    min="0"
                  />
                </div>
                <Input
                  label="Languages"
                  name="languages"
                  value={values.languages}
                  onChange={handleChange}
                  placeholder="English, Hindi, Marathi"
                  hint="Enter languages separated by commas."
                  error={errors.languages}
                />
                <Input
                  label="Registration / Bar Council number"
                  name="registrationNumber"
                  value={values.registrationNumber}
                  onChange={handleChange}
                  placeholder="e.g. MAH/12345/2010"
                  error={errors.registrationNumber}
                  required
                />
                <div className="w-full">
                  <label
                    htmlFor="bio"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Professional bio
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    rows={4}
                    value={values.bio}
                    onChange={handleChange}
                    placeholder="Briefly describe your practice, expertise and the kind of clients you help."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <SectionHeading>Verification documents</SectionHeading>
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <UploadCloud size={24} />
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    Upload your ID & registration certificate
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Drag & drop files here, or browse. PDF, JPG or PNG up to
                    10MB.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    disabled
                  >
                    Browse files
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Creating account…' : 'Create professional account'}
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
