'use client';

// Signup — role-aware registration.
//  - Step 1: choose Client or Professional.
//  - Client  -> simple client form -> signup() -> "check your email" screen.
//  - Professional -> pick a professional type -> dynamic multi-section form
//    (ProfessionalRegistrationForm) -> registerProfessional() -> a pending-
//    approval confirmation screen (verify email + awaiting admin approval).

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  User,
  Briefcase,
  Scale,
  Calculator,
  MailCheck,
  ShieldCheck,
  Smartphone,
  KeyRound,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import BrandLogo from '@/components/common/BrandLogo';
import PhotoUpload from '@/components/common/PhotoUpload';
import { useAuth } from '@/components/AuthProvider';
import {
  resendVerification,
  checkAvailability,
  checkPhone,
} from '@/services/authService';
import {
  sendPhoneOtp,
  confirmPhoneOtp,
  clearRecaptcha,
  loadFirebaseConfig,
  firebaseConfigured,
} from '@/lib/firebase';

const SIGNUP_RESEND_COOLDOWN_SECONDS = 300;
import {
  updateProfile,
  updateProfessionalDetails,
  getProfile,
} from '@/services/profileService';
import { valuesFromProfile } from '@/components/professionals/ProfessionalRegistrationForm';
import { isEmail, isPhone, isStrongPassword } from '@/utils/validators';
import { useLocations } from '@/hooks/useLocations';
import Combobox from '@/components/common/Combobox';
import ProfessionalRegistrationForm, {
  PROFESSIONAL_TYPES,
} from '@/components/professionals/ProfessionalRegistrationForm';

const CLIENT_EMPTY = {
  firstName: '',
  lastName: '',
  email: '',
  mobileNumber: '',
  password: '',
  confirmPassword: '',
  country: '',
  state: '',
  city: '',
  addressLine: '',
  profilePhoto: '',
};

function validateClient(values) {
  const errors = {};
  if (!values.firstName.trim()) errors.firstName = 'First name is required.';
  if (!values.lastName.trim()) errors.lastName = 'Last name is required.';
  if (!values.email.trim()) errors.email = 'Email is required.';
  else if (!isEmail(values.email))
    errors.email = 'Enter a valid email address.';
  // mobileNumber is captured + verified via OTP in the phone step now, so
  // we accept whatever the phone wizard committed without re-validating.
  if (!values.country.trim()) errors.country = 'Country is required.';
  if (!values.state.trim()) errors.state = 'State is required.';
  if (!values.city.trim()) errors.city = 'City is required.';
  return errors;
}

/** Map a backend 422 errors map onto our flat field names. */
function mapServerErrors(err) {
  const out = {};
  const errs = err && err.payload && err.payload.errors;
  if (errs && typeof errs === 'object') {
    for (const [k, v] of Object.entries(errs)) {
      // Flatten nested keys like "legal.jurisdiction" -> "jurisdiction".
      const short = k.includes('.') ? k.split('.').pop() : k;
      out[short] = typeof v === 'string' ? v : String(v);
    }
  }
  return out;
}

function Chrome({ children }) {
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
      <main className="flex flex-1 justify-center px-4 py-10 sm:py-14">
        {children}
      </main>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary in app-router pages so
// the page can bail out of static prerendering cleanly. Wrapped at the
// default export below.
function SignupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    signup,
    signupWithFirebase,
    registerProfessional,
    isAuthenticated,
    loading,
    user,
  } = useAuth();

  // step: 'phone' | 'role' | 'client' | 'pro-type' | 'pro-form'
  // Phone is the new first step — verify OTP before anything else. Once
  // verified the number is locked for the rest of the wizard (per spec).
  const [step, setStep] = useState('phone');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [firebaseIdToken, setFirebaseIdToken] = useState('');
  const [proType, setProType] = useState('');
  // Resume mode: pre-filled wizard at Step 2 for a professional whose Step
  // 1 already created the account but who bounced before finishing.
  const [resumeInitialValues, setResumeInitialValues] = useState(null);
  const [resumeStep, setResumeStep] = useState(1);
  const [resumeLoading, setResumeLoading] = useState(false);

  // Client form state.
  const [client, setClient] = useState(CLIENT_EMPTY);
  const [clientErrors, setClientErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState('');

  // Admin-managed city list powers the signup dropdown.
  const {
    countries,
    statesByCountry,
    citiesByState,
    countryById,
    stateById,
    cityById,
  } = useLocations();

  const clientCountryId =
    countries.find((c) => c.name === client.country)?.id || '';
  const clientStateRows = statesByCountry(clientCountryId);
  const clientStateId =
    clientStateRows.find((s) => s.name === client.state)?.id || '';
  const clientCityRows = citiesByState(clientStateId);
  const clientCityId =
    clientCityRows.find((c) => c.name === client.city)?.id || '';
  function clientPickCountry(id) {
    const c = countryById(id);
    setClient((v) => ({ ...v, country: c ? c.name : '', state: '', city: '' }));
    setClientErrors((er) => ({
      ...er,
      country: undefined,
      state: undefined,
      city: undefined,
    }));
  }
  function clientPickState(id) {
    const s = stateById(id);
    setClient((v) => ({ ...v, state: s ? s.name : '', city: '' }));
    setClientErrors((er) => ({ ...er, state: undefined, city: undefined }));
  }
  function clientPickCity(id) {
    const c = cityById(id);
    setClient((v) => ({ ...v, city: c ? c.name : '' }));
    setClientErrors((er) => ({ ...er, city: undefined }));
  }

  // Professional form state.
  const [proSubmitting, setProSubmitting] = useState(false);
  const [proBanner, setProBanner] = useState('');
  const [proServerErrors, setProServerErrors] = useState({});

  // Post-signup screens.
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [pendingScreen, setPendingScreen] = useState(false);
  const [resendNotice, setResendNotice] = useState('');
  const [resendError, setResendError] = useState('');
  const [resending, setResending] = useState(false);

  // Auth gate: send finished users to /dashboard, BUT keep professionals
  // with an incomplete signup on this page so they can finish.
  useEffect(() => {
    if (loading || !isAuthenticated) return;
    const incompletePro =
      user && user.role === 'professional' && user.signupComplete === false;
    if (incompletePro) return;
    router.replace('/dashboard');
  }, [loading, isAuthenticated, user, router]);

  // Resume flow: when an incomplete-signup professional lands here we
  // skip the role / pro-type screens, pre-fill the wizard with their
  // saved data, and start at Step 2.
  //
  // We DON'T run this if the wizard just registered the account this
  // session — it already has the in-memory state and reloading would
  // remount the wizard mid-flow.
  useEffect(() => {
    if (loading || !isAuthenticated || !user) return;
    if (user.role !== 'professional') return;
    if (user.signupComplete) return;
    if (proAccountCreated) return;
    if (resumeInitialValues || resumeLoading) return;
    setResumeLoading(true);
    (async () => {
      try {
        const profile = await getProfile();
        const vals = valuesFromProfile(profile);
        // Mark Step 1 as already created so handleProStepSave skips the
        // duplicate register call.
        setProAccountCreated(true);
        setResumeInitialValues(vals);
        // Derive the locked professional type from the saved row.
        const t = String(
          (profile &&
            profile.professionalDetail &&
            profile.professionalDetail.professionalType) ||
            ''
        ).toLowerCase();
        if (t.includes('legal') || t.includes('lawyer') || t.includes('advocate')) {
          setProType(PROFESSIONAL_TYPES.LEGAL);
        } else if (t.includes('tax') || t.includes('gst') || t.includes('ca')) {
          setProType(PROFESSIONAL_TYPES.TAX);
        } else {
          setProType(PROFESSIONAL_TYPES.LEGAL);
        }
        setResumeStep(2);
        setStep('pro-form');
      } catch {
        /* if profile fetch fails, fall through to the role screen */
      } finally {
        setResumeLoading(false);
      }
    })();
  }, [
    loading,
    isAuthenticated,
    user,
    resumeInitialValues,
    resumeLoading,
  ]);

  function handleClientChange(e) {
    const { name, value } = e.target;
    setClient((v) => ({ ...v, [name]: value }));
    setClientErrors((er) => ({ ...er, [name]: undefined }));
  }

  async function handleClientSubmit(e) {
    e.preventDefault();
    setBanner('');
    const errs = validateClient(client);
    setClientErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // Defense in depth — the phone step should have set these before we
    // reach this submit handler. If for some reason it didn't, bounce back.
    if (!firebaseIdToken || !verifiedPhone) {
      setBanner('Please verify your mobile number first.');
      setStep('phone');
      return;
    }

    const email = client.email.trim();
    setSubmitting(true);
    try {
      // Phone-first signup — backend creates the account from the verified
      // Firebase token + the rest of the profile, then issues our session.
      // The user is logged in immediately on success; no email verification
      // gate (phone is the channel of verification).
      await signupWithFirebase({
        idToken: firebaseIdToken,
        firstName: client.firstName.trim(),
        lastName: client.lastName.trim(),
        email,
        role: 'client',
      });
      // Note: address / photo / etc. fields collected here will be saved
      // via a profile-update call once we wire it; for the v1 of the
      // phone-first flow the account is created and the user lands on
      // /dashboard.
      setSubmittedEmail(email);
      router.push('/dashboard');
    } catch (err) {
      setClientErrors(mapServerErrors(err));
      setBanner(
        (err && err.message) ||
          'Unable to create your account. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Tracks whether Step 1 of the signup wizard has already created the
  // account. Subsequent steps only need to upsert the existing profile.
  const [proAccountCreated, setProAccountCreated] = useState(false);

  // Flatten the wizard's register-mode payload into the shape the
  // PUT /api/profile/professional endpoint expects (top-level identifiers
  // + document URLs + legacy `lawyer` sub-object).
  function flattenProPayload(payload) {
    const isLegal = payload.professionalType === PROFESSIONAL_TYPES.LEGAL;
    const legal = payload.legal || {};
    const tax = payload.tax || {};
    const out = {
      professionalType: payload.professionalType,
      designation: payload.designation || undefined,
      bio: payload.bio || undefined,
      yearsOfExperience: payload.yearsOfExperience,
      consultationFee: payload.consultationFee,
      skills: payload.skills,
      languages: payload.languages,
      education: payload.education,
      certifications: payload.certifications,
      website: payload.website,
      linkedin: payload.linkedin,
      availability: payload.availability,
      subCategoryIds: payload.subCategoryIds || [],
      practiceCities: payload.practiceCities || [],
      // Promoted identifiers
      barRegistrationNumber: isLegal
        ? legal.barRegistrationNumber || null
        : null,
      enrollmentNumber: isLegal ? legal.enrollmentNumber || null : null,
      licenseNumber: isLegal ? legal.advocateLicenseNumber || null : null,
      taxRegistrationNumber: !isLegal ? tax.taxRegistrationNumber || null : null,
      chamberAddress: isLegal ? legal.chamberAddress || null : null,
      consultancyType: isLegal
        ? legal.consultationType || null
        : tax.consultationType || null,
      courtsPracticing: isLegal ? legal.courtPractice || [] : [],
      // Documents
      governmentIdDoc: payload.governmentId || null,
      advocateLicenseDoc: isLegal ? legal.advocateLicense || null : null,
      barCouncilCertDoc: isLegal ? legal.barCouncilRegistration || null : null,
      lawDegreeDoc: isLegal ? legal.lawDegreeDocument || null : null,
      taxRegistrationCertDoc: !isLegal
        ? tax.taxConsultantCertificate || null
        : null,
      qualificationCertDoc: !isLegal
        ? tax.registrationCertificate || null
        : null,
      professionalLicenseDoc: !isLegal ? tax.professionalLicense || null : null,
      // Legacy lawyer sub-fields not promoted to top-level
      lawyer: isLegal
        ? {
            practiceAreas: legal.practiceAreas || [],
            jurisdiction: legal.jurisdiction || '',
            lawDegree: legal.lawDegree || '',
            availability: payload.availability || [],
          }
        : undefined,
    };
    return out;
  }

  // Per-step save invoked by the wizard before advancing. Throws on
  // failure so the wizard stays on the current step.
  async function handleProStepSave(payload, currentStep) {
    setProBanner('');
    setProServerErrors({});
    // Tracks whether this handler has already set a richer banner (e.g.
    // the account-exists JSX with sign-in / recover links). The catch
    // below would otherwise overwrite it with `err.message` because the
    // closure's view of `proBanner` is the stale pre-throw state.
    let bannerSet = false;
    try {
      if (currentStep === 1) {
        // Pre-flight: warn if email or phone already belongs to a user.
        const avail = await checkAvailability({
          email: payload.email,
          mobileNumber: payload.mobileNumber,
        });
        if (avail && avail.takenBy) {
          const which =
            avail.takenBy === 'both'
              ? 'this email and phone number'
              : avail.takenBy === 'mobile'
                ? 'this phone number'
                : 'this email';
          setProBanner(
            <span>
              An account already exists with {which}. You can{' '}
              <Link
                href="/login"
                className="font-semibold underline hover:text-red-800"
              >
                sign in
              </Link>{' '}
              or{' '}
              <Link
                href="/forgot-password"
                className="font-semibold underline hover:text-red-800"
              >
                recover your password
              </Link>{' '}
              to continue.
            </span>
          );
          bannerSet = true;
          throw new Error('Account already exists');
        }
        // Create the account. After this, the user is authenticated and
        // subsequent steps update the live profile.
        // IMPORTANT: do NOT set `submittedEmail` here — that flag flips
        // the page into the "Check your email" screen and would short-
        // circuit the wizard before Step 2. It's only set on the final
        // Step-3 submit.
        if (!proAccountCreated) {
          await registerProfessional(payload);
          setProAccountCreated(true);
        }
        return;
      }
      if (currentStep === 2) {
        await updateProfile({
          firstName: payload.firstName,
          lastName: payload.lastName,
          mobileNumber: payload.mobileNumber,
          profilePhoto: payload.profilePhoto,
          address: {
            country: payload.country,
            state: payload.state,
            city: payload.city,
            addressLine: payload.addressLine,
          },
        });
        const flat = flattenProPayload(payload);
        // Strip docs from step 2; they're saved on final submit.
        for (const k of [
          'governmentIdDoc',
          'advocateLicenseDoc',
          'barCouncilCertDoc',
          'lawDegreeDoc',
          'taxRegistrationCertDoc',
          'qualificationCertDoc',
          'professionalLicenseDoc',
        ]) {
          delete flat[k];
        }
        await updateProfessionalDetails(flat);
      }
    } catch (err) {
      const serverErrors = mapServerErrors(err);
      setProServerErrors(serverErrors);
      // Only fall back to a generic banner when the try block hasn't
      // already set a richer one (e.g. the account-exists JSX). The
      // closure-captured `proBanner` is stale and unreliable.
      if (!bannerSet) {
        setProBanner(
          (err && err.message) || 'Could not save this step. Please try again.'
        );
      }
      throw err;
    }
  }

  async function handleProSubmit(payload) {
    setProBanner('');
    setProServerErrors({});
    setProSubmitting(true);
    try {
      if (!proAccountCreated) {
        // Defensive: legacy flow where the submit fires before any
        // step-save has run. Register first, then continue.
        await registerProfessional(payload);
        setProAccountCreated(true);
      }
      // Final step — persist the document URLs and flip the signup-complete
      // flag so the global guard stops bouncing this professional back to
      // the wizard.
      const flat = flattenProPayload(payload);
      const docsOnly = { professionalType: flat.professionalType, _finalize: true };
      for (const k of [
        'governmentIdDoc',
        'advocateLicenseDoc',
        'barCouncilCertDoc',
        'lawDegreeDoc',
        'taxRegistrationCertDoc',
        'qualificationCertDoc',
        'professionalLicenseDoc',
      ]) {
        if (flat[k] !== undefined) docsOnly[k] = flat[k];
      }
      await updateProfessionalDetails(docsOnly);
      setSubmittedEmail(payload.email || '');
      setPendingScreen(true);
      if (typeof window !== 'undefined')
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const serverErrors = mapServerErrors(err);
      setProServerErrors(serverErrors);
      if (err && err.status === 409) {
        setProBanner(
          (err && err.message) ||
            'An account with this email already exists.'
        );
      } else if (err && err.status === 422) {
        setProBanner(
          (err && err.message) ||
            'Please fix the highlighted fields and try again.'
        );
      } else {
        setProBanner(
          (err && err.message) ||
            'Unable to submit your registration. Please try again.'
        );
      }
      if (typeof window !== 'undefined')
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setProSubmitting(false);
    }
  }

  async function handleResend() {
    if (resending || !submittedEmail) return;
    setResendError('');
    setResendNotice('');
    setResending(true);
    try {
      const res = await resendVerification(submittedEmail);
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

  const clientFieldClass = (name) =>
    `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:outline-none focus:ring-2 ${
      clientErrors[name]
        ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
        : 'border-slate-300 focus:border-amber-500 focus:ring-amber-200'
    }`;

  // ---- Confirmation: client "check your email" ----------------------------
  if (submittedEmail && !pendingScreen) {
    return (
      <Chrome>
        <div className="w-full max-w-md">
          <div className="glass rounded-2xl border border-slate-200/80 p-7 text-center shadow-card sm:p-8">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-amber-600">
              <MailCheck size={28} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Check your email
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              We sent a verification link to
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">
              {submittedEmail}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Open that email and click the link to activate your account. The
              link expires soon, so do it while it&apos;s fresh.
            </p>

            {resendNotice && (
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-left text-sm text-teal-700">
                <MailCheck size={16} className="mt-0.5 shrink-0" />
                <span>{resendNotice}</span>
              </div>
            )}
            {resendError && (
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-left text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{resendError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
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

            <p className="mt-5 text-sm text-slate-600">
              Already verified?{' '}
              <Link
                href="/login"
                className="font-semibold text-amber-700 hover:text-amber-800"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </Chrome>
    );
  }

  // ---- Confirmation: professional pending-approval ------------------------
  if (pendingScreen) {
    return (
      <Chrome>
        <div className="w-full max-w-md">
          <div className="glass rounded-2xl border border-slate-200/80 p-7 text-center shadow-card sm:p-8">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-amber-600">
              <ShieldCheck size={28} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Registration submitted
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Thanks for registering as a professional. Two things happen next:
            </p>

            <div className="mt-4 space-y-2.5 text-left">
              <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <MailCheck
                  size={18}
                  className="mt-0.5 shrink-0 text-amber-600"
                />
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">
                    Verify your email.
                  </span>{' '}
                  We sent a link to{' '}
                  <span className="font-medium text-slate-800">
                    {submittedEmail}
                  </span>
                  .
                </p>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <ShieldCheck
                  size={18}
                  className="mt-0.5 shrink-0 text-teal-600"
                />
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">
                    Admin approval.
                  </span>{' '}
                  Your profile is pending review. You&apos;ll be emailed once
                  it&apos;s approved.
                </p>
              </div>
            </div>

            {resendNotice && (
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-left text-sm text-teal-700">
                <MailCheck size={16} className="mt-0.5 shrink-0" />
                <span>{resendNotice}</span>
              </div>
            )}
            {resendError && (
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-left text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{resendError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
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

            <p className="mt-5 text-sm text-slate-600">
              <Link
                href="/login"
                className="font-semibold text-amber-700 hover:text-amber-800"
              >
                Go to sign in
              </Link>
            </p>
          </div>
        </div>
      </Chrome>
    );
  }

  // ---- Step 0: verify mobile number via OTP -----------------------------
  // The phone is captured + verified BEFORE any other field. Once verified
  // it is locked for the rest of the wizard — per spec, users cannot change
  // their phone number mid-signup.
  if (step === 'phone') {
    return (
      <Chrome>
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Verify your mobile
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              We&apos;ll send a one-time code to confirm it&apos;s really you.
            </p>
          </div>
          <PhoneVerifyStep
            initialPhone={searchParams.get('phone') || ''}
            onVerified={(phoneE164, idToken) => {
              setVerifiedPhone(phoneE164);
              setFirebaseIdToken(idToken);
              // Pre-fill the client form's mobile (legacy field) so the
              // later steps display the verified number.
              setClient((v) => ({ ...v, mobileNumber: phoneE164 }));
              setStep('role');
            }}
          />
          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-amber-700 hover:text-amber-800"
            >
              Sign in
            </Link>
          </p>
        </div>
      </Chrome>
    );
  }

  // ---- Step 1: choose a role ---------------------------------------------
  if (step === 'role') {
    return (
      <Chrome>
        <div className="w-full max-w-lg">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Register with Pro<span className="text-gradient"> Firmo</span>
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              First, tell us how you want to use Pro Firmo.
            </p>
          </div>
          <div className="glass rounded-2xl border border-slate-200/80 p-6 shadow-card sm:p-7">
            <p className="mb-3 text-sm font-medium text-slate-700">
              Register as
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setStep('client')}
                className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-amber-300 hover:bg-amber-50/50"
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-amber-100 text-amber-600">
                  <User size={20} />
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  Client
                </span>
                <span className="text-xs text-slate-500">
                  Find and consult verified legal &amp; tax professionals.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStep('pro-type')}
                className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-amber-300 hover:bg-amber-50/50"
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal-100 text-teal-600">
                  <Briefcase size={20} />
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  Professional
                </span>
                <span className="text-xs text-slate-500">
                  Offer legal or tax services. Reviewed by our team.
                </span>
              </button>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-amber-700 hover:text-amber-800"
            >
              Sign in
            </Link>
          </p>
        </div>
      </Chrome>
    );
  }

  // ---- Client form -------------------------------------------------------
  if (step === 'client') {
    return (
      <Chrome>
        <div className="w-full max-w-lg">
          <button
            type="button"
            onClick={() => setStep('role')}
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-amber-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Create your client account
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Join Pro<span className="text-gradient"> Firmo</span> in a couple
              of minutes.
            </p>
          </div>

          <div className="glass rounded-2xl border border-slate-200/80 p-6 shadow-card sm:p-7">
            {banner && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{banner}</span>
              </div>
            )}

            <form
              onSubmit={handleClientSubmit}
              className="space-y-4"
              noValidate
            >
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Profile photo
                </p>
                <PhotoUpload
                  value={client.profilePhoto}
                  onChange={(url) =>
                    setClient((v) => ({ ...v, profilePhoto: url }))
                  }
                  category="profile_photo"
                  shape="circle"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    First name
                  </label>
                  <input
                    name="firstName"
                    value={client.firstName}
                    onChange={handleClientChange}
                    placeholder="Aarav"
                    className={clientFieldClass('firstName')}
                  />
                  {clientErrors.firstName && (
                    <p className="mt-1 text-xs text-red-600">
                      {clientErrors.firstName}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Last name
                  </label>
                  <input
                    name="lastName"
                    value={client.lastName}
                    onChange={handleClientChange}
                    placeholder="Mehta"
                    className={clientFieldClass('lastName')}
                  />
                  {clientErrors.lastName && (
                    <p className="mt-1 text-xs text-red-600">
                      {clientErrors.lastName}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email address
                </label>
                <input
                  name="email"
                  type="email"
                  value={client.email}
                  onChange={handleClientChange}
                  placeholder="you@example.com"
                  className={clientFieldClass('email')}
                />
                {clientErrors.email && (
                  <p className="mt-1 text-xs text-red-600">
                    {clientErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Mobile number
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    <CheckCircle2 size={10} />
                    Verified
                  </span>
                </label>
                <input
                  name="mobileNumber"
                  type="tel"
                  value={client.mobileNumber || verifiedPhone}
                  readOnly
                  disabled
                  className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Phone numbers cannot be changed during signup. You can change
                  it from your profile after creating the account.
                </p>
              </div>

              {/* Password fields removed — phone OTP is the auth method for
                  accounts created via this wizard. */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Combobox
                  label="Country"
                  name="country"
                  value={clientCountryId}
                  onChange={(e) => clientPickCountry(e.target.value)}
                  placeholder="Select country…"
                  options={countries.map((c) => ({ value: c.id, label: c.name }))}
                  error={clientErrors.country}
                  required
                />
                <Combobox
                  label="State"
                  name="state"
                  value={clientStateId}
                  onChange={(e) => clientPickState(e.target.value)}
                  placeholder={
                    clientCountryId ? 'Select state…' : 'Pick a country first'
                  }
                  options={clientStateRows.map((s) => ({
                    value: s.id,
                    label: s.name,
                  }))}
                  disabled={!clientCountryId}
                  error={clientErrors.state}
                  required
                />
                <Combobox
                  label="City"
                  name="city"
                  value={clientCityId}
                  onChange={(e) => clientPickCity(e.target.value)}
                  placeholder={
                    clientStateId ? 'Select city…' : 'Pick a state first'
                  }
                  options={clientCityRows.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                  disabled={!clientStateId}
                  error={clientErrors.city}
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Address line
                </label>
                <input
                  name="addressLine"
                  value={client.addressLine}
                  onChange={handleClientChange}
                  placeholder="Street, building, area"
                  className={clientFieldClass('addressLine')}
                />
                {clientErrors.addressLine && (
                  <p className="mt-1 text-xs text-red-600">
                    {clientErrors.addressLine}
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
                    Creating account…
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-amber-700 hover:text-amber-800"
            >
              Sign in
            </Link>
          </p>
        </div>
      </Chrome>
    );
  }

  // ---- Professional: pick a type -----------------------------------------
  if (step === 'pro-type') {
    return (
      <Chrome>
        <div className="w-full max-w-lg">
          <button
            type="button"
            onClick={() => setStep('role')}
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-amber-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              What kind of professional are you?
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              This tailors the registration form to your practice.
            </p>
          </div>
          <div className="glass rounded-2xl border border-slate-200/80 p-6 shadow-card sm:p-7">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setProType(PROFESSIONAL_TYPES.LEGAL);
                  setProServerErrors({});
                  setProBanner('');
                  setStep('pro-form');
                }}
                className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-amber-300 hover:bg-amber-50/50"
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-amber-100 text-amber-600">
                  <Scale size={20} />
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  Legal Consultant / Advocate
                </span>
                <span className="text-xs text-slate-500">
                  Bar registration, practice areas, court practice.
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setProType(PROFESSIONAL_TYPES.TAX);
                  setProServerErrors({});
                  setProBanner('');
                  setStep('pro-form');
                }}
                className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-amber-300 hover:bg-amber-50/50"
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal-100 text-teal-600">
                  <Calculator size={20} />
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  Tax Consultant
                </span>
                <span className="text-xs text-slate-500">
                  Tax registration, GST &amp; income tax expertise.
                </span>
              </button>
            </div>
          </div>
        </div>
      </Chrome>
    );
  }

  // ---- Professional: the dynamic form ------------------------------------
  return (
    <Chrome>
      <div className="w-full max-w-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep('pro-type')}
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-amber-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Change type
          </button>
          {/* Inline type switcher — re-renders the form's legal/tax section. */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
            {[PROFESSIONAL_TYPES.LEGAL, PROFESSIONAL_TYPES.TAX].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setProType(t);
                  setProServerErrors({});
                }}
                className={`rounded-md px-2.5 py-1.5 font-semibold transition ${
                  proType === t
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t === PROFESSIONAL_TYPES.LEGAL ? 'Legal' : 'Tax'}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Professional registration
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Complete every section. Your profile is reviewed before it goes
            live.
          </p>
        </div>

        {/* `key` forces a clean form remount when the type changes so the
            legal/tax section and its state switch correctly. */}
        <ProfessionalRegistrationForm
          key={`${proType}-${resumeInitialValues ? 'resume' : 'fresh'}`}
          mode="register"
          professionalType={proType}
          initialValues={resumeInitialValues || undefined}
          initialStep={resumeStep}
          submitLabel="Submit registration"
          submitting={proSubmitting}
          banner={proBanner}
          serverErrors={proServerErrors}
          onSubmit={handleProSubmit}
          onStepSave={handleProStepSave}
          // Phone-first wizard: the mobile was verified in step 'phone'.
          // Lock the field in the pro form so it can't be edited from here.
          lockedMobileNumber={verifiedPhone}
        />

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-semibold text-amber-700 hover:text-amber-800"
          >
            Sign in
          </Link>
        </p>
      </div>
    </Chrome>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// PhoneVerifyStep — the first screen of the signup wizard. Same OTP flow
// as the login Phone tab, with two product differences:
//   - Reject phones that are ALREADY registered (sign up means new account)
//   - On success, hand the (phoneE164, firebaseIdToken) up to the parent.
// ---------------------------------------------------------------------------
function PhoneVerifyStep({ initialPhone = '', onVerified }) {
  // When the wizard was deep-linked with ?phone=… (e.g. from the "create
  // an account" CTA on the sign-in page), we lock the number — the user
  // arrived here specifically to verify THAT phone, not pick a new one.
  const phoneLocked = Boolean(initialPhone);
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState('');
  const [innerStep, setInnerStep] = useState('enter-phone');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [configState, setConfigState] = useState('loading');
  const confirmationRef = useRef(null);

  useEffect(() => {
    let active = true;
    loadFirebaseConfig().then(() => {
      if (!active) return;
      setConfigState(firebaseConfigured() ? 'ready' : 'unavailable');
    });
    return () => {
      active = false;
      clearRecaptcha();
    };
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setInterval(() => {
      setResendIn((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  function toE164(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('+'))
      return '+' + trimmed.slice(1).replace(/[^0-9]/g, '');
    const digits = trimmed.replace(/[^0-9]/g, '');
    if (digits.length === 10) return '+91' + digits;
    if (digits.length === 12 && digits.startsWith('91')) return '+' + digits;
    return '+' + digits;
  }

  function fmtMmSs(t) {
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  async function handleSendOtp(e) {
    e && e.preventDefault();
    setError('');
    setInfo('');
    if (configState !== 'ready') {
      setError('Phone sign-in is not configured yet. Please contact support.');
      return;
    }
    const e164 = toE164(phone);
    if (!/^\+\d{8,15}$/.test(e164)) {
      setError('Enter a valid phone number including the country code.');
      return;
    }
    setSubmitting(true);
    try {
      // Reject numbers that are already registered — signup is for NEW
      // accounts. Existing users go through /login instead.
      const check = await checkPhone(e164);
      if (check && check.exists) {
        setError(
          'This phone number is already registered. Please sign in instead.'
        );
        return;
      }
      const confirmation = await sendPhoneOtp(e164, 'signup-recaptcha-container');
      confirmationRef.current = confirmation;
      setInnerStep('enter-code');
      setInfo(`We sent a 6-digit code to ${e164}.`);
      setResendIn(SIGNUP_RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(
        (err && (err.message || err.code)) ||
          'Could not send the OTP. Please try again.'
      );
      clearRecaptcha();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    if (!confirmationRef.current) {
      setError('Please request a new OTP first.');
      setInnerStep('enter-phone');
      return;
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter the 6-digit code from the SMS.');
      return;
    }
    setSubmitting(true);
    try {
      const idToken = await confirmPhoneOtp(confirmationRef.current, otp.trim());
      onVerified(toE164(phone), idToken);
    } catch (err) {
      setError(
        (err && err.message) ||
          'Could not verify the code. It may be wrong or expired.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resending || resendIn > 0) return;
    setResending(true);
    setError('');
    setInfo('');
    clearRecaptcha();
    confirmationRef.current = null;
    try {
      const e164 = toE164(phone);
      const confirmation = await sendPhoneOtp(e164, 'signup-recaptcha-container');
      confirmationRef.current = confirmation;
      setInfo(`A new code was sent to ${e164}.`);
      setResendIn(SIGNUP_RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(
        (err && err.message) || 'Could not resend the OTP. Please try again.'
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="glass rounded-2xl border border-slate-200/80 p-6 shadow-card sm:p-7">
      {configState === 'loading' && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          <Loader2 size={16} className="animate-spin" />
          <span>Loading sign-up options…</span>
        </div>
      )}
      {configState === 'unavailable' && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>
            Phone sign-up is not configured yet. Please contact support.
          </span>
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm text-teal-800">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{info}</span>
        </div>
      )}

      {innerStep === 'enter-phone' && (
        <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="signup-phone"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Mobile number
            </label>
            <div className="relative">
              <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="signup-phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                autoComplete="tel"
                inputMode="tel"
                readOnly={phoneLocked}
                disabled={phoneLocked}
                className={`w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm transition focus:outline-none focus:ring-2 ${
                  phoneLocked
                    ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-600'
                    : 'border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:ring-amber-200'
                }`}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {phoneLocked
                ? 'This phone number was passed in from sign-in. You will receive a 6-digit OTP by SMS to confirm it.'
                : 'Indian numbers default to +91. You will receive a 6-digit OTP by SMS.'}
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

      {innerStep === 'enter-code' && (
        <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="signup-otp"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              6-digit code
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="signup-otp"
                name="otp"
                type="text"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                }
                placeholder="123456"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-base tracking-[0.4em] text-slate-800 placeholder-slate-400 transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
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
                Verify and continue
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
          <div className="flex items-center justify-between text-xs">
            {phoneLocked ? (
              <span />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setInnerStep('enter-phone');
                  setOtp('');
                  setError('');
                  setInfo('');
                }}
                className="font-semibold text-slate-500 transition hover:text-slate-700"
              >
                Use a different number
              </button>
            )}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || resendIn > 0}
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

      <div id="signup-recaptcha-container" className="mt-3 flex justify-center" />
    </div>
  );
}
