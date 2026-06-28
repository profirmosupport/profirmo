'use client';

// /join-team/onboard — onboard a professional with the full signup
// wizard. Reuses ProfessionalRegistrationForm so the field set is
// identical to /signup. Two onboarding-specific tweaks:
//
//   1. "Referred by" is pre-filled with the logged-in employee's
//      employee_code and LOCKED so the credit always goes to the
//      employee doing the onboarding.
//   2. OTP send / verify lives inline under the mobile-number field
//      via the form's phoneFieldFooter extension slot. The Submit
//      button stays disabled until the OTP has been verified for the
//      current mobile-number value.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Scale,
  ClipboardList,
  Send,
  ShieldCheck,
} from 'lucide-react';
import EmployeeHeader from '@/components/employee/EmployeeHeader';
import Footer from '@/components/common/Footer';
import ProfessionalRegistrationForm from '@/components/professionals/ProfessionalRegistrationForm';
import {
  sendPhoneOtp,
  verifyPhoneOtp,
} from '@/services/authService';
import {
  request,
  employeeGetMe,
  getEmployeeProfile,
  clearEmployeeSession,
} from '@/services/employeeAuthService';

const PRO_TYPES = [
  {
    value: 'Legal Consultant',
    label: 'Legal Consultant',
    description: 'Advocates, lawyers, paralegals.',
    icon: Scale,
  },
  {
    value: 'Tax Consultant',
    label: 'Tax Consultant',
    description: 'CAs, tax advisors, GST experts.',
    icon: ClipboardList,
  },
];

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
        <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
      ) : (
        <AlertCircle size={14} className="mt-0.5 shrink-0" />
      )}
      <span>{children}</span>
    </div>
  );
}

export default function OnboardProfessionalPage() {
  const router = useRouter();
  const [professionalType, setProfessionalType] = useState('');
  const [banner, setBanner] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState({});

  // The employee profile — referralCode pre-fill source.
  const [me, setMe] = useState(getEmployeeProfile());

  // OTP state. `verifiedPhone` tracks the exact phone number that was
  // OTP-verified; the Submit button stays disabled until the current
  // mobile-number input matches it.
  const [otpStage, setOtpStage] = useState('idle'); // 'idle' | 'sent'
  const [otpCode, setOtpCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpNotice, setOtpNotice] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');

  useEffect(() => {
    employeeGetMe()
      .then((fresh) => {
        if (fresh) setMe(fresh);
      })
      .catch((err) => {
        if (err.status === 401 || err.status === 403) {
          clearEmployeeSession();
          router.replace('/join-team/login');
        }
      });
  }, [router]);

  const initialValues = useMemo(
    () => ({
      referralCode: me?.employeeCode || '',
    }),
    [me]
  );

  // ---- Inline OTP helpers ------------------------------------------------

  function normPhone(raw) {
    return String(raw || '').replace(/[\s-]/g, '').trim();
  }

  async function sendOtp(phone) {
    const p = normPhone(phone);
    if (!/^\+?\d{8,15}$/.test(p)) {
      setOtpError('Enter a valid phone number with country code first.');
      setOtpNotice('');
      return;
    }
    setOtpError('');
    setOtpNotice('');
    setOtpBusy(true);
    try {
      await sendPhoneOtp(p, 'signup');
      setOtpStage('sent');
      setOtpNotice(`OTP sent to ${p}.`);
      // Editing the phone after verifying invalidates the previous
      // verification — clear it so the user re-verifies.
      if (verifiedPhone && verifiedPhone !== p) setVerifiedPhone('');
    } catch (err) {
      setOtpError(err.message || 'Could not send OTP.');
    } finally {
      setOtpBusy(false);
    }
  }

  async function verifyOtp(phone) {
    const p = normPhone(phone);
    if (!otpCode.trim()) {
      setOtpError('Enter the OTP that was sent.');
      return;
    }
    setOtpError('');
    setOtpNotice('');
    setOtpBusy(true);
    try {
      await verifyPhoneOtp(p, 'signup', otpCode.trim());
      setVerifiedPhone(p);
      setOtpNotice('Phone number verified. You can submit the form now.');
    } catch (err) {
      setOtpError(err.message || 'OTP verification failed.');
    } finally {
      setOtpBusy(false);
    }
  }

  // ---- Form submit -------------------------------------------------------
  async function handleSubmit(payload) {
    setBanner('');
    setSuccess('');
    setServerErrors({});
    const phone = normPhone(payload.mobileNumber);
    if (verifiedPhone !== phone) {
      setBanner(
        'Verify the professional’s phone number via OTP before submitting.'
      );
      return;
    }
    setSubmitting(true);
    try {
      await request('/api/employee/onboard-professional', {
        method: 'POST',
        body: { ...payload, otpCode: otpCode.trim() },
        auth: true,
      });
      setSuccess(
        'Professional submitted for admin approval. You will earn commission once admin approves.'
      );
      // Reset transient state so the next onboarding starts clean.
      setVerifiedPhone('');
      setOtpStage('idle');
      setOtpCode('');
      setOtpNotice('');
      setOtpError('');
      setProfessionalType('');
    } catch (err) {
      if (err && err.errors) {
        setServerErrors(err.errors);
      }
      setBanner(err.message || 'Could not register the professional.');
    } finally {
      setSubmitting(false);
    }
  }

  const chooserDone = useMemo(
    () => Boolean(professionalType),
    [professionalType]
  );

  // The inline OTP UI rendered just under the mobile-number field
  // inside the form. Receives the current `values` object so the
  // adapter can read the latest mobileNumber.
  function renderPhoneFooter(values) {
    const phone = normPhone(values.mobileNumber);
    const verified = phone && phone === verifiedPhone;
    return (
      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        {verified ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
            <ShieldCheck size={14} />
            Verified — ready to submit.
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-600">
              Send an OTP to the professional&apos;s number for
              verification.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => sendOtp(phone)}
                disabled={otpBusy || !phone}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {otpBusy && otpStage === 'idle' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Send size={12} />
                )}
                {otpStage === 'sent' ? 'Resend OTP' : 'Send OTP'}
              </button>
              {otpStage === 'sent' ? (
                <>
                  <input
                    inputMode="numeric"
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(
                        e.target.value.replace(/\D/g, '').slice(0, 8)
                      )
                    }
                    placeholder="Enter OTP"
                    className="w-32 rounded-lg border border-slate-300 px-3 py-1.5 text-sm tracking-[0.3em] focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                  <button
                    type="button"
                    onClick={() => verifyOtp(phone)}
                    disabled={otpBusy || !otpCode}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                  >
                    {otpBusy && otpStage === 'sent' ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={12} />
                    )}
                    Verify
                  </button>
                </>
              ) : null}
            </div>
          </>
        )}
        {otpError ? (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-red-700">
            <AlertCircle size={11} className="mt-0.5 shrink-0" />
            {otpError}
          </div>
        ) : null}
        {otpNotice && !verified ? (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-emerald-700">
            <CheckCircle2 size={11} className="mt-0.5 shrink-0" />
            {otpNotice}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <EmployeeHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <Link
            href="/join-team/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={14} />
            Back to dashboard
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            Onboard professional
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Same form the professional would fill on /signup. Verify
            their phone via OTP under the mobile field, then submit for
            admin approval. Commission is credited only after admin
            approves the profile.
          </p>

          <div className="mt-6 space-y-4">
            <Banner tone="error">{banner}</Banner>
            <Banner tone="success">{success}</Banner>

            {!chooserDone ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-base font-semibold text-slate-900">
                  Professional type
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Pick the kind of consultant you&apos;re onboarding.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {PRO_TYPES.map(({ value, label, description, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setProfessionalType(value)}
                      className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-amber-300 hover:bg-amber-50"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                        <Icon size={18} />
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">{label}</p>
                        <p className="text-xs text-slate-500">{description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                  <div className="text-sm">
                    <p className="font-semibold text-amber-900">
                      {professionalType}
                    </p>
                    <p className="mt-0.5 text-xs text-amber-800">
                      Referred by{' '}
                      <span className="font-mono font-bold">
                        {me?.employeeCode || '—'}
                      </span>{' '}
                      — locked to your employee code.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfessionalType('')}
                    className="text-xs font-semibold text-amber-900 underline-offset-2 hover:underline"
                  >
                    Change type
                  </button>
                </div>

                <ProfessionalRegistrationForm
                  key={professionalType}
                  mode="register"
                  professionalType={professionalType}
                  initialValues={initialValues}
                  referralLocked
                  // Locking the mobile input once it's been verified
                  // prevents the employee from editing the number
                  // post-OTP — the field shows "Mobile number
                  // (verified)" and reads from `lockedMobileNumber`.
                  lockedMobileNumber={verifiedPhone || ''}
                  phoneFieldFooter={renderPhoneFooter}
                  submitLabel={
                    submitting
                      ? 'Submitting…'
                      : verifiedPhone
                        ? 'Submit for approval'
                        : 'Verify phone to submit'
                  }
                  submitting={submitting}
                  banner=""
                  serverErrors={serverErrors}
                  onSubmit={handleSubmit}
                />
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
