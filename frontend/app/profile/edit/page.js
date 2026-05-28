'use client';

// Profile EDIT page.
// For professionals: renders the same 3-step signup wizard
// (ProfessionalRegistrationForm) so the edit experience is byte-for-byte
// identical to signup. The category picked at signup is passed in as a
// prop and not editable — once a professional registers as Legal or Tax
// they cannot switch categories from the edit page.
//
// For non-professional roles (clients) the lightweight PersonalInfoForm
// is still used since they have no professional details to edit.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import EmptyState from '@/components/common/EmptyState';
import { useAuth } from '@/components/AuthProvider';
import {
  getProfile,
  updateProfile,
  updateProfessionalDetails,
} from '@/services/profileService';
import PersonalInfoForm from '@/components/profile/PersonalInfoForm';
import ProfessionalRegistrationForm, {
  PROFESSIONAL_TYPES,
  valuesFromProfile,
} from '@/components/professionals/ProfessionalRegistrationForm';
import { useCategories } from '@/hooks/useAppSettings';

function EditSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <div className="h-10 w-48 animate-pulse rounded bg-slate-100" />
      {[...Array(2)].map((_, i) => (
        <div
          key={i}
          className="h-72 w-full animate-pulse rounded-xl bg-slate-100"
        />
      ))}
    </div>
  );
}

// Match the slug of the professional's primaryCategoryId (or fall back to
// professionalType) to either Legal or Tax. The signup wizard expects one
// of PROFESSIONAL_TYPES, which is what determines the conditional layout.
function deriveProfessionalType(profile, categories) {
  const detail = (profile && profile.professionalDetail) || {};
  const primaryId = detail.primaryCategoryId;
  if (primaryId && Array.isArray(categories)) {
    const cat = categories.find((c) => c.id === primaryId);
    if (cat) {
      const slug = String(cat.slug || '').toLowerCase();
      if (slug === 'legal') return PROFESSIONAL_TYPES.LEGAL;
      if (slug === 'tax') return PROFESSIONAL_TYPES.TAX;
    }
  }
  const t = String(detail.professionalType || '').toLowerCase();
  if (/lawyer|advocate|legal/.test(t)) return PROFESSIONAL_TYPES.LEGAL;
  if (/tax|ca|gst|chartered/.test(t)) return PROFESSIONAL_TYPES.TAX;
  // Default to Legal so the wizard renders something rather than blanking.
  return PROFESSIONAL_TYPES.LEGAL;
}

export default function ProfileEditPage() {
  const router = useRouter();
  const {
    user: authUser,
    loading: authLoading,
    isAuthenticated,
    refreshUser,
  } = useAuth();
  const { categories } = useCategories();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState('');
  const [success, setSuccess] = useState('');

  // Route guard.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getProfile();
      setProfile(data);
    } catch (err) {
      setError(err.message || 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      load();
    }
  }, [authLoading, isAuthenticated, load]);

  const handlePersonalSaved = useCallback(
    async (refreshed) => {
      if (refreshed) setProfile(refreshed);
      await refreshUser();
    },
    [refreshUser]
  );

  // Build the wizard's initial values from the live profile + the
  // professional type derived from the locked category.
  const initialValues = useMemo(() => valuesFromProfile(profile), [profile]);
  const lockedProfessionalType = useMemo(
    () => deriveProfessionalType(profile, categories),
    [profile, categories]
  );

  // Helpers — split the wizard's flat payload into the bits each endpoint
  // accepts. Step 1 = identity + address, Step 2 = professional core +
  // identifiers, Step 3 (final submit) = documents.
  const personalPart = (payload) => ({
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
  const documentKeys = [
    'governmentIdDoc',
    'advocateLicenseDoc',
    'barCouncilCertDoc',
    'lawDegreeDoc',
    'taxRegistrationCertDoc',
    'qualificationCertDoc',
    'professionalLicenseDoc',
  ];
  const professionalPart = (payload, opts = {}) => {
    const {
      firstName,
      lastName,
      mobileNumber,
      profilePhoto,
      country,
      state,
      city,
      addressLine,
      ...professional
    } = payload;
    if (opts.includeDocs === false) {
      const stripped = { ...professional };
      for (const k of documentKeys) delete stripped[k];
      return stripped;
    }
    if (opts.docsOnly) {
      const docs = { professionalType: professional.professionalType };
      for (const k of documentKeys) {
        if (professional[k] !== undefined) docs[k] = professional[k];
      }
      return docs;
    }
    return professional;
  };

  // Per-step save: invoked by the wizard's Continue button BEFORE advancing.
  // Throws on failure so the wizard stays on the current step.
  const handleStepSave = useCallback(
    async (payload, currentStep) => {
      setBanner('');
      setSuccess('');
      try {
        if (currentStep === 1) {
          await updateProfile(personalPart(payload));
          setSuccess('Step 1 saved — personal info updated.');
        } else if (currentStep === 2) {
          const refreshed = await updateProfessionalDetails(
            professionalPart(payload, { includeDocs: false })
          );
          if (refreshed) setProfile(refreshed);
          setSuccess('Step 2 saved — professional details updated.');
        }
        await refreshUser();
      } catch (err) {
        const msg = err.message || 'Could not save this step.';
        setBanner(msg);
        // Re-throw so the wizard doesn't advance past a failed save.
        throw err;
      }
    },
    [refreshUser]
  );

  // Final submit (Step 3) — persist the document URLs, refresh, then send the
  // user back to their dashboard so they can see the updated completion %.
  const handleSubmit = useCallback(
    async (payload) => {
      if (submitting) return;
      setBanner('');
      setSuccess('');
      setSubmitting(true);
      try {
        const refreshed = await updateProfessionalDetails(
          professionalPart(payload, { docsOnly: true })
        );
        if (refreshed) setProfile(refreshed);
        await refreshUser();
        setSuccess('All set — your profile is up to date.');
        router.push('/dashboard');
      } catch (err) {
        setBanner(err.message || 'Could not save your documents.');
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, refreshUser, router]
  );

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Header />
        <main className="flex-1">
          <EditSkeleton />
        </main>
        <Footer />
      </div>
    );
  }

  const user = (profile && profile.user) || authUser || {};
  const role = user.role;
  const isProfessional =
    role === 'professional' || role === 'firm_professional';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      <main className="flex-1">
        {loading ? (
          <EditSkeleton />
        ) : error ? (
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
            <EmptyState
              icon={<AlertCircle size={24} />}
              title="Could not load your profile"
              description={error}
              action={
                <Button
                  onClick={load}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  Retry
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Edit profile
                </h1>
                <p className="text-sm text-slate-500">
                  Update your account information.
                </p>
              </div>
              <Button href="/dashboard" variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" />
                Back to dashboard
              </Button>
            </div>

            {isProfessional ? (
              <>
                {/* Category lock notice — professionals cannot switch
                    primary category once they've signed up. The wizard
                    below receives this as a prop and renders the matching
                    Legal / Tax fields. */}
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Primary category
                      </p>
                      <p className="mt-0.5 text-base font-semibold text-slate-900">
                        {lockedProfessionalType ===
                        PROFESSIONAL_TYPES.LEGAL
                          ? 'Legal Consultant / Advocate'
                          : 'Tax Consultant'}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      Locked
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    The primary category is set at signup and cannot be
                    changed here. Contact support if you need to switch
                    categories.
                  </p>
                </Card>

                {success && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {success}
                  </div>
                )}

                <ProfessionalRegistrationForm
                  mode="edit"
                  professionalType={lockedProfessionalType}
                  initialValues={initialValues}
                  submitLabel="Save documents"
                  submitting={submitting}
                  banner={banner}
                  onSubmit={handleSubmit}
                  onStepSave={handleStepSave}
                />
              </>
            ) : (
              <PersonalInfoForm
                user={user}
                address={profile && profile.address}
                onSaved={handlePersonalSaved}
              />
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
