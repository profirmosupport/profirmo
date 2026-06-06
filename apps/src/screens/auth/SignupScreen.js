import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import AuthShell from '../../components/auth/AuthShell';
import AuthInput from '../../components/auth/AuthInput';
import GradientButton from '../../components/auth/GradientButton';
import PhotoUpload from '../../components/auth/PhotoUpload';
import DocSlot from '../../components/auth/DocSlot';
import StepProgress from '../../components/auth/StepProgress';
import SearchableSelect from '../../components/auth/SearchableSelect';
import SearchableMultiSelect from '../../components/auth/SearchableMultiSelect';
import CheckboxRow from '../../components/auth/CheckboxRow';
import SkipButton from '../../components/auth/SkipButton';
import {
  registerProfessional,
  checkPhone,
  sendPhoneOtp,
  verifyPhoneOtp,
} from '../../services/authService';
import {
  listCategories,
  listLocations,
} from '../../services/appSettingsService';
import { ROLES } from '../../config/constants';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

// SignupScreen — mirrors the web flow:
//
//   role          → pick Client vs Professional
//     ├─ client   → single page (matches the web client form 1:1)
//     └─ pro-type → Legal Consultant vs Tax Consultant
//          └─ pro-form (3 steps with progress chrome):
//               Step 1 — Personal info  (photo, name, contact, cascading
//                                        country/state/city, practice
//                                        cities multi-select, address,
//                                        bio, sub-category chips)
//               Step 2 — Professional details (experience, links, type-
//                                              specific identifiers,
//                                              tax expertise checkboxes)
//               Step 3 — Documents (Govt ID + type-specific certificates)
//
// Submits hit /api/auth/signup for clients and /api/auth/register-professional
// for pros — the same endpoints the web wizard uses.

const PRO_TYPES = { LEGAL: 'Legal Consultant', TAX: 'Tax Consultant' };
const CONSULTATION_OPTIONS = [
  { value: 'Online', label: 'Online' },
  { value: 'In-person', label: 'In-person' },
  { value: 'Both', label: 'Both' },
];
const PRO_STEP_LABELS = ['Personal', 'Details', 'Documents'];

// ===========================================================================
// useLocations / useCategories — fetch hierarchies once per mount and
// hand back the helpers Step 1 needs to feed cascading dropdowns.
// ===========================================================================

function useLocations() {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await listLocations();
        if (active) setCountries(rows);
      } catch {
        if (active) setCountries([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  return { countries, loading };
}

function useCategories() {
  const [cats, setCats] = useState([]);
  useEffect(() => {
    let active = true;
    listCategories().then((rows) => {
      if (active) setCats(rows);
    });
    return () => {
      active = false;
    };
  }, []);
  return cats;
}

// Find the {Legal} / {Tax} category — the names happen to match
// PRO_TYPES values minus the trailing " Consultant".
function categoryForType(cats, professionalType) {
  if (!professionalType) return null;
  const wanted = professionalType.split(' ')[0].toLowerCase(); // 'legal' | 'tax'
  return cats.find((c) => String(c.name || '').toLowerCase() === wanted) || null;
}

// ===========================================================================
// SignupScreen
// ===========================================================================

export default function SignupScreen({ navigation }) {
  const { enterGuest } = useAuth();
  // phone (OTP) → role → client | pro-type → pro-form
  const [step, setStep] = useState('phone');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [proType, setProType] = useState(null);

  function goBack() {
    if (step === 'role') setStep('phone');
    else if (step === 'client' || step === 'pro-type') setStep('role');
    else if (step === 'pro-form') setStep('pro-type');
  }

  return (
    <AuthShell
      title={
        step === 'phone'
          ? 'Verify your mobile'
          : step === 'role'
            ? 'Create your account'
            : step === 'pro-type'
              ? 'Professional registration'
              : null
      }
      subtitle={
        step === 'phone'
          ? "We'll send a one-time code to confirm it's really you."
          : step === 'role'
            ? 'How will you use Profirmo?'
            : step === 'pro-type'
              ? 'Pick the kind of practice you run.'
              : null
      }
      topRight={
        step === 'phone' ? <SkipButton onPress={enterGuest} /> : null
      }
      footer={
        <Text style={styles.footerText}>
          Already have an account?{' '}
          <Text
            style={styles.footerLink}
            onPress={() => navigation.navigate('Login')}
          >
            Sign in
          </Text>
        </Text>
      }
    >
      {step !== 'phone' ? (
        <Pressable onPress={goBack} style={styles.backRow} hitSlop={8}>
          <Feather name="chevron-left" size={16} color={colors.textSecondary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      ) : null}

      {step === 'phone' ? (
        <PhoneVerifyStep
          onVerified={(phoneE164) => {
            setVerifiedPhone(phoneE164);
            setStep('role');
          }}
          onAlreadyRegistered={() => navigation.navigate('Login')}
        />
      ) : step === 'role' ? (
        <RoleStep
          onPickClient={() => setStep('client')}
          onPickProfessional={() => setStep('pro-type')}
        />
      ) : step === 'client' ? (
        <ClientStep verifiedPhone={verifiedPhone} />
      ) : step === 'pro-type' ? (
        <ProTypeStep
          onPickLegal={() => {
            setProType(PRO_TYPES.LEGAL);
            setStep('pro-form');
          }}
          onPickTax={() => {
            setProType(PRO_TYPES.TAX);
            setStep('pro-form');
          }}
        />
      ) : (
        <ProRegistrationWizard
          professionalType={proType}
          verifiedPhone={verifiedPhone}
        />
      )}
    </AuthShell>
  );
}

// ===========================================================================
// PhoneVerifyStep — first step of signup. Mirrors the web's
// PhoneVerifyStep: enter phone → send OTP → enter code → verify.
// Rejects numbers already attached to an account.
// ===========================================================================

const SIGNUP_RESEND_COOLDOWN_SECONDS = 300;

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

function PhoneVerifyStep({ onVerified, onAlreadyRegistered }) {
  const [innerStep, setInnerStep] = useState('enter-phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setInterval(() => {
      setResendIn((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  async function handleSendOtp() {
    setError('');
    setInfo('');
    setAlreadyRegistered(false);
    const e164 = toE164(phone);
    if (!/^\+\d{8,15}$/.test(e164)) {
      setError('Enter a valid phone number including the country code.');
      return;
    }
    setSubmitting(true);
    try {
      // Signup is for NEW accounts — reject numbers that already exist.
      const check = await checkPhone(e164);
      if (check && check.exists) {
        setAlreadyRegistered(true);
        return;
      }
      await sendPhoneOtp(e164, 'signup');
      setSentTo(e164);
      setInnerStep('enter-code');
      setInfo(`We sent a 6-digit code to ${e164}.`);
      setResendIn(SIGNUP_RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err.message || 'Could not send the OTP. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp() {
    setError('');
    if (!sentTo) {
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
      await verifyPhoneOtp(sentTo, 'signup', otp.trim());
      onVerified(sentTo);
    } catch (err) {
      setError(
        err.message || 'Could not verify the code. It may be wrong or expired.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resending || resendIn > 0 || submitting) return;
    setResending(true);
    setError('');
    setInfo('');
    try {
      const target = sentTo || toE164(phone);
      await sendPhoneOtp(target, 'signup');
      setSentTo(target);
      setInfo(`A new code was sent to ${target}.`);
      setResendIn(SIGNUP_RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err.message || 'Could not resend the OTP. Please try again.');
    } finally {
      setResending(false);
    }
  }

  return (
    <View>
      {error ? (
        <View style={[styles.banner, styles.bannerDanger]}>
          <Feather
            name="alert-circle"
            size={14}
            color={colors.dangerSoftText}
          />
          <Text style={[styles.bannerText, { color: colors.dangerSoftText }]}>
            {error}
          </Text>
        </View>
      ) : null}
      {info ? (
        <View style={[styles.banner, styles.bannerSuccess]}>
          <Feather name="check-circle" size={14} color={colors.success} />
          <Text style={[styles.bannerText, { color: colors.success }]}>
            {info}
          </Text>
        </View>
      ) : null}
      {alreadyRegistered ? (
        <View style={styles.alreadyBox}>
          <Feather name="alert-circle" size={14} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.alreadyTitle}>
              This phone number is already registered.
            </Text>
            <Text style={styles.alreadyText}>Sign in instead to continue.</Text>
            <Pressable
              onPress={onAlreadyRegistered}
              style={({ pressed }) => [
                styles.alreadyCta,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.alreadyCtaText}>Go to sign in</Text>
              <Feather name="arrow-right" size={13} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {innerStep === 'enter-phone' ? (
        <>
          <AuthInput
            label="Mobile number"
            icon="smartphone"
            keyboardType="phone-pad"
            placeholder="+91 98xxxxxxxx"
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              if (error) setError('');
              if (alreadyRegistered) setAlreadyRegistered(false);
            }}
            hint="Indian numbers default to +91. You'll receive a 6-digit OTP by SMS."
          />
          <GradientButton
            title={submitting ? 'Sending OTP…' : 'Send OTP'}
            loading={submitting}
            onPress={handleSendOtp}
            style={{ marginTop: 6 }}
          />
        </>
      ) : (
        <>
          <AuthInput
            label="6-digit code"
            icon="key"
            keyboardType="number-pad"
            placeholder="123456"
            value={otp}
            onChangeText={(v) => {
              setOtp(v.replace(/[^0-9]/g, '').slice(0, 6));
              if (error) setError('');
            }}
            maxLength={6}
            editable={!submitting}
          />
          <GradientButton
            title={submitting ? 'Verifying…' : 'Verify and continue'}
            loading={submitting}
            onPress={handleVerifyOtp}
            style={{ marginTop: 6 }}
          />
          <View style={styles.otpFooter}>
            <Pressable
              disabled={submitting}
              onPress={() => {
                setInnerStep('enter-phone');
                setOtp('');
                setError('');
                setInfo('');
              }}
              hitSlop={6}
            >
              <Text
                style={[
                  styles.linkMuted,
                  submitting && { color: colors.textMuted },
                ]}
              >
                Use a different number
              </Text>
            </Pressable>
            <Pressable
              disabled={submitting || resending || resendIn > 0}
              onPress={handleResend}
              hitSlop={6}
            >
              <Text
                style={[
                  styles.linkAccent,
                  (submitting || resending || resendIn > 0) && {
                    color: colors.textMuted,
                  },
                ]}
              >
                {resending
                  ? 'Resending…'
                  : resendIn > 0
                    ? `Resend in ${fmtMmSs(resendIn)}`
                    : 'Resend code'}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

// ===========================================================================
// Role steps
// ===========================================================================

function RoleStep({ onPickClient, onPickProfessional }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <RoleCard
        icon="user"
        tone="amber"
        title="Client"
        description="Find and consult verified legal & tax professionals."
        onPress={onPickClient}
      />
      <RoleCard
        icon="briefcase"
        tone="teal"
        title="Professional"
        description="Offer legal or tax services. Reviewed by our team."
        onPress={onPickProfessional}
      />
    </View>
  );
}

function ProTypeStep({ onPickLegal, onPickTax }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <RoleCard
        icon="award"
        tone="amber"
        title="Legal Consultant / Advocate"
        description="Bar registration, practice areas, court practice."
        onPress={onPickLegal}
      />
      <RoleCard
        icon="bar-chart-2"
        tone="teal"
        title="Tax Consultant"
        description="Tax registration, GST & income tax expertise."
        onPress={onPickTax}
      />
    </View>
  );
}

function RoleCard({ icon, tone, title, description, onPress }) {
  const accent = tone === 'teal' ? CARD_TONES.teal : CARD_TONES.amber;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.roleCard,
        pressed && {
          backgroundColor: accent.bgPressed,
          borderColor: accent.border,
        },
      ]}
    >
      <View style={[styles.roleIcon, { backgroundColor: accent.bg }]}>
        <Feather name={icon} size={18} color={accent.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.roleTitle}>{title}</Text>
        <Text style={styles.roleDesc}>{description}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const CARD_TONES = {
  amber: { bg: colors.primarySoft, fg: colors.primary, border: colors.primary, bgPressed: '#fffbeb' },
  teal: { bg: '#ccfbf1', fg: '#0d9488', border: '#0d9488', bgPressed: '#f0fdfa' },
};

// ===========================================================================
// Location dropdowns — shared between Client + Pro Step 1
// ===========================================================================

function LocationFields({
  countries,
  countryId,
  stateId,
  cityId,
  onChange, // { countryId, stateId, cityId }
  errors = {},
}) {
  const country = countries.find((c) => c.id === countryId) || null;
  const states = country ? country.states || [] : [];
  const stateRow = states.find((s) => s.id === stateId) || null;
  const cities = stateRow ? stateRow.cities || [] : [];

  return (
    <View>
      <SearchableSelect
        label="Country"
        icon="globe"
        placeholder="Select country…"
        options={countries.map((c) => ({ value: c.id, label: c.name }))}
        value={countryId}
        onChange={(v) =>
          onChange({ countryId: v, stateId: '', cityId: '' })
        }
        error={errors.country}
      />
      <SearchableSelect
        label="State"
        icon="map"
        placeholder={countryId ? 'Select state…' : 'Pick a country first'}
        options={states.map((s) => ({ value: s.id, label: s.name }))}
        value={stateId}
        onChange={(v) => onChange({ countryId, stateId: v, cityId: '' })}
        disabled={!countryId}
        error={errors.state}
      />
      <SearchableSelect
        label="City"
        icon="map-pin"
        placeholder={stateId ? 'Select city…' : 'Pick a state first'}
        options={cities.map((c) => ({ value: c.id, label: c.name }))}
        value={cityId}
        onChange={(v) => onChange({ countryId, stateId, cityId: v })}
        disabled={!stateId}
        error={errors.city}
      />
    </View>
  );
}

// Flatten the locations tree into a "Bengaluru — Karnataka" pickable
// list for the Practice cities multi-select (Pro Step 1).
function flatCityOptions(countries) {
  const out = [];
  for (const c of countries) {
    for (const s of c.states || []) {
      for (const city of s.cities || []) {
        out.push({ value: city.id, label: `${city.name} — ${s.name}` });
      }
    }
  }
  return out;
}

// ===========================================================================
// Client step — matches the web client form
// ===========================================================================

function ClientStep({ verifiedPhone }) {
  const { signup, signupWithPhone } = useAuth();
  const { countries } = useLocations();

  // When the wizard reached us via the phone-OTP first step, sign up
  // with /api/auth/phone-signup (no password required) and lock the
  // mobile field to the verified number. Otherwise fall back to the
  // legacy /api/auth/signup flow with password + optional mobile.
  const phoneFirst = Boolean(verifiedPhone);

  const [form, setForm] = useState({
    profilePhoto: '',
    firstName: '',
    lastName: '',
    email: '',
    mobileNumber: verifiedPhone || '',
    password: '',
    countryId: '',
    stateId: '',
    cityId: '',
    addressLine: '',
  });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (k, v) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  function setLocation(next) {
    setForm((prev) => ({ ...prev, ...next }));
    setErrors((p) => ({
      ...p,
      country: undefined,
      state: undefined,
      city: undefined,
    }));
  }

  function validate() {
    const next = {};
    if (!form.firstName.trim()) next.firstName = 'First name is required.';
    if (!form.lastName.trim()) next.lastName = 'Last name is required.';
    if (!form.email.trim()) next.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = 'Enter a valid email.';
    // Password is only required on the legacy (non-phone-OTP) signup
    // path — phone-OTP signups have no password (phone is the channel
    // of verification).
    if (!phoneFirst) {
      if (!form.password) next.password = 'Password is required.';
      else if (form.password.length < 6)
        next.password = 'At least 6 characters.';
    }
    if (!form.countryId) next.country = 'Country is required.';
    if (!form.stateId) next.state = 'State is required.';
    if (!form.cityId) next.city = 'City is required.';
    if (!form.addressLine.trim()) next.addressLine = 'Address line is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setBanner('');
    setSubmitting(true);
    try {
      if (phoneFirst) {
        // Phone-first signup — the backend redeems the verified OTP
        // we just minted and returns the standard session payload.
        await signupWithPhone({
          phone: verifiedPhone,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          role: ROLES.CLIENT,
        });
        // (Address / photo / etc. get captured in the dashboard
        // profile screen — v1 of the phone-first flow keeps the
        // create-account payload narrow.)
        return; // loader stays on until the auth flip swaps the navigator
      }
      const country = countries.find((c) => c.id === form.countryId);
      const state = country?.states?.find((s) => s.id === form.stateId);
      const city = state?.cities?.find((c) => c.id === form.cityId);
      await signup({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        mobileNumber: form.mobileNumber.trim(),
        role: ROLES.CLIENT,
        profilePhoto: form.profilePhoto || undefined,
        country: country ? country.name : undefined,
        countryId: form.countryId || undefined,
        state: state ? state.name : undefined,
        stateId: form.stateId || undefined,
        city: city ? city.name : undefined,
        cityId: form.cityId || undefined,
        addressLine: form.addressLine.trim() || undefined,
      });
    } catch (err) {
      setBanner(err.message || 'Signup failed. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <View>
      {banner ? <Banner text={banner} /> : null}

      <SectionLabel>Profile photo</SectionLabel>
      <PhotoUpload
        value={form.profilePhoto}
        onChange={(url) => set('profilePhoto', url)}
        category="profile_photo"
      />

      <SectionLabel>Personal</SectionLabel>
      <Row>
        <AuthInput
          label="First name"
          icon="user"
          autoCapitalize="words"
          placeholder="Aarav"
          value={form.firstName}
          onChangeText={(v) => set('firstName', v)}
          error={errors.firstName}
        />
        <AuthInput
          label="Last name"
          icon="user"
          autoCapitalize="words"
          placeholder="Mehta"
          value={form.lastName}
          onChangeText={(v) => set('lastName', v)}
          error={errors.lastName}
        />
      </Row>
      <AuthInput
        label="Email address"
        icon="mail"
        keyboardType="email-address"
        placeholder="you@example.com"
        value={form.email}
        onChangeText={(v) => set('email', v)}
        error={errors.email}
      />
      {phoneFirst ? (
        <VerifiedPhoneDisplay phone={form.mobileNumber} />
      ) : (
        <AuthInput
          label="Mobile number"
          icon="smartphone"
          keyboardType="phone-pad"
          placeholder="+91 98xxxxxxxx"
          value={form.mobileNumber}
          onChangeText={(v) => set('mobileNumber', v)}
          hint="You can verify your number after signup."
        />
      )}
      {/* Phone-first signup is password-less — phone is the channel of
          verification. The password field is only shown on the legacy
          path (which is no longer reachable from the new flow but
          kept for back-compat with deep links). */}
      {!phoneFirst ? (
        <AuthInput
          label="Password"
          icon="lock"
          secureTextEntry
          placeholder="At least 6 characters"
          value={form.password}
          onChangeText={(v) => set('password', v)}
          error={errors.password}
        />
      ) : null}

      <SectionLabel>Location</SectionLabel>
      <LocationFields
        countries={countries}
        countryId={form.countryId}
        stateId={form.stateId}
        cityId={form.cityId}
        onChange={setLocation}
        errors={errors}
      />
      <AuthInput
        label="Address line"
        icon="home"
        autoCapitalize="sentences"
        placeholder="Street, building, area"
        value={form.addressLine}
        onChangeText={(v) => set('addressLine', v)}
        error={errors.addressLine}
      />

      <GradientButton
        title={submitting ? 'Creating account…' : 'Create account'}
        loading={submitting}
        onPress={handleSubmit}
        style={{ marginTop: spacing.md }}
      />

      <Text style={styles.tos}>
        By continuing you agree to Profirmo's Terms of Service and Privacy
        Policy.
      </Text>
    </View>
  );
}

// ===========================================================================
// Professional 3-step wizard
// ===========================================================================

function ProRegistrationWizard({ professionalType, verifiedPhone }) {
  const { refresh } = useAuth();
  const isLegal = professionalType === PRO_TYPES.LEGAL;
  const { countries } = useLocations();
  const cats = useCategories();
  const flatCities = useMemo(() => flatCityOptions(countries), [countries]);
  const typeCat = useMemo(
    () => categoryForType(cats, professionalType),
    [cats, professionalType]
  );

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    // Step 1 — personal
    profilePhoto: '',
    firstName: '',
    lastName: '',
    email: '',
    // Pre-fill from the OTP-verified phone and lock the field. The
    // user can change their number later from the profile screen
    // (which has its own OTP re-verification flow). Keeping it
    // immutable here prevents pros from signing up with one number
    // and operating under another mid-flow.
    mobileNumber: verifiedPhone || '',
    password: '',
    confirmPassword: '',
    countryId: '',
    stateId: '',
    cityId: '',
    practiceCityIds: [],
    addressLine: '',
    bio: '',
    subCategoryIds: [],

    // Step 2 — professional details
    yearsOfExperience: '',
    consultationFee: '',
    skills: '',
    languages: '',
    education: '',
    certifications: '',
    website: '',
    linkedin: '',
    availability: '',
    // Legal
    barRegistrationNumber: '',
    enrollmentNumber: '',
    advocateLicenseNumber: '',
    practiceAreas: '',
    courtPractice: '',
    jurisdiction: '',
    chamberAddress: '',
    lawDegree: '',
    legalConsultationType: 'Online',
    yearsOfPractice: '',
    // Tax
    taxRegistrationNumber: '',
    specializationAreas: '',
    gstExpertise: false,
    incomeTaxExpertise: false,
    corporateTaxExpertise: false,
    businessAdvisory: false,
    accountingServices: false,
    financialPlanning: false,
    taxConsultationType: 'Online',

    // Step 3 — documents
    governmentId: '',
    advocateLicense: '',
    barCouncilRegistration: '',
    lawDegreeDocument: '',
    taxConsultantCertificate: '',
    registrationCertificate: '',
    professionalLicense: '',
  });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (k, v) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  function setLocation(next) {
    setForm((prev) => ({ ...prev, ...next }));
    setErrors((p) => ({
      ...p,
      country: undefined,
      state: undefined,
      city: undefined,
    }));
  }

  function validateStep(n) {
    const next = {};
    if (n === 1) {
      if (!form.firstName.trim()) next.firstName = 'Required.';
      if (!form.lastName.trim()) next.lastName = 'Required.';
      if (!form.email.trim()) next.email = 'Required.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
        next.email = 'Enter a valid email.';
      if (!form.mobileNumber.trim()) next.mobileNumber = 'Required.';
      if (!form.password) next.password = 'Required.';
      else if (form.password.length < 6)
        next.password = 'At least 6 characters.';
      if (form.confirmPassword !== form.password)
        next.confirmPassword = 'Passwords do not match.';
      if (!form.countryId) next.country = 'Required.';
      if (!form.stateId) next.state = 'Required.';
      if (!form.cityId) next.city = 'Required.';
    } else if (n === 2 && isLegal) {
      if (!form.barRegistrationNumber.trim())
        next.barRegistrationNumber = 'Required.';
      if (!form.enrollmentNumber.trim()) next.enrollmentNumber = 'Required.';
    } else if (n === 2 && !isLegal) {
      if (!form.taxRegistrationNumber.trim())
        next.taxRegistrationNumber = 'Required.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function next() {
    if (!validateStep(step)) return;
    if (step < 3) setStep(step + 1);
  }
  function prev() {
    if (step > 1) setStep(step - 1);
  }

  async function handleSubmit() {
    if (!validateStep(1) || !validateStep(2)) {
      setStep(validateStep(1) ? 2 : 1);
      return;
    }
    setBanner('');
    setSubmitting(true);
    const country = countries.find((c) => c.id === form.countryId);
    const state = country?.states?.find((s) => s.id === form.stateId);
    const city = state?.cities?.find((c) => c.id === form.cityId);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        mobileNumber: form.mobileNumber.trim(),
        password: form.password,
        professionalType,
        country: country ? country.name : form.countryId,
        countryId: form.countryId,
        state: state ? state.name : form.stateId,
        stateId: form.stateId,
        city: city ? city.name : form.cityId,
        cityId: form.cityId,
        practiceCities: form.practiceCityIds,
        addressLine: form.addressLine.trim() || undefined,
        bio: form.bio.trim() || undefined,
        profilePhoto: form.profilePhoto || undefined,
        primaryCategoryId: typeCat ? typeCat.id : undefined,
        subCategoryIds: form.subCategoryIds,
        // Step 2 — shared
        yearsOfExperience: form.yearsOfExperience || undefined,
        consultationFee: form.consultationFee || undefined,
        skills: form.skills || undefined,
        languages: form.languages || undefined,
        education: form.education || undefined,
        certifications: form.certifications || undefined,
        website: form.website.trim() || undefined,
        linkedin: form.linkedin.trim() || undefined,
        availability: form.availability || undefined,
        // Step 3 — common documents
        governmentId: form.governmentId || undefined,
        // Type-specific nested + top-level
        ...(isLegal
          ? {
              barRegistrationNumber:
                form.barRegistrationNumber.trim() || undefined,
              enrollmentNumber: form.enrollmentNumber.trim() || undefined,
              advocateLicenseNumber:
                form.advocateLicenseNumber.trim() || undefined,
              practiceAreas: form.practiceAreas.trim() || undefined,
              courtPractice: form.courtPractice.trim() || undefined,
              jurisdiction: form.jurisdiction.trim() || undefined,
              chamberAddress: form.chamberAddress.trim() || undefined,
              lawDegree: form.lawDegree.trim() || undefined,
              yearsOfPractice: form.yearsOfPractice || undefined,
              consultancyType: form.legalConsultationType,
              legal: {
                barRegistrationNumber: form.barRegistrationNumber.trim(),
                enrollmentNumber: form.enrollmentNumber.trim(),
                advocateLicenseNumber: form.advocateLicenseNumber.trim(),
                practiceAreas: form.practiceAreas.trim(),
                courtPractice: form.courtPractice.trim(),
                jurisdiction: form.jurisdiction.trim(),
                chamberAddress: form.chamberAddress.trim(),
                lawDegree: form.lawDegree.trim(),
                yearsOfPractice: form.yearsOfPractice,
                consultationType: form.legalConsultationType,
                advocateLicense: form.advocateLicense || undefined,
                barCouncilRegistration:
                  form.barCouncilRegistration || undefined,
                lawDegreeDocument: form.lawDegreeDocument || undefined,
              },
            }
          : {
              taxRegistrationNumber:
                form.taxRegistrationNumber.trim() || undefined,
              specializationAreas:
                form.specializationAreas.trim() || undefined,
              consultancyType: form.taxConsultationType,
              tax: {
                taxRegistrationNumber: form.taxRegistrationNumber.trim(),
                specializationAreas: form.specializationAreas.trim(),
                gstExpertise: form.gstExpertise,
                incomeTaxExpertise: form.incomeTaxExpertise,
                corporateTaxExpertise: form.corporateTaxExpertise,
                businessAdvisory: form.businessAdvisory,
                accountingServices: form.accountingServices,
                financialPlanning: form.financialPlanning,
                consultationType: form.taxConsultationType,
                taxConsultantCertificate:
                  form.taxConsultantCertificate || undefined,
                registrationCertificate:
                  form.registrationCertificate || undefined,
                professionalLicense: form.professionalLicense || undefined,
              },
            }),
      };
      await registerProfessional(payload);
      setSuccess(true);
      await refresh();
    } catch (err) {
      if (err && err.errors && typeof err.errors === 'object') {
        setErrors((prev) => ({ ...prev, ...err.errors }));
      }
      setBanner(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <View style={styles.successWrap}>
        <View style={styles.successRing}>
          <Feather name="check-circle" size={36} color={colors.success} />
        </View>
        <Text style={styles.successTitle}>Registration submitted</Text>
        <Text style={styles.successBody}>
          Our team is reviewing your details. You'll receive an email once
          your profile is approved — usually within 24–48 hours.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <StepProgress
        step={step}
        total={3}
        labels={PRO_STEP_LABELS}
        badge={professionalType}
        badgeIcon={isLegal ? 'award' : 'bar-chart-2'}
      />

      {banner ? <Banner text={banner} /> : null}

      {step === 1 ? (
        <Step1
          form={form}
          set={set}
          setLocation={setLocation}
          errors={errors}
          countries={countries}
          flatCities={flatCities}
          typeCat={typeCat}
          verifiedPhone={verifiedPhone}
        />
      ) : step === 2 ? (
        <Step2 form={form} set={set} errors={errors} isLegal={isLegal} />
      ) : (
        <Step3 form={form} set={set} isLegal={isLegal} />
      )}

      <View style={styles.navRow}>
        {step > 1 ? (
          <Pressable
            onPress={prev}
            style={({ pressed }) => [
              styles.prevBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Feather name="chevron-left" size={16} color={colors.textPrimary} />
            <Text style={styles.prevBtnText}>Back</Text>
          </Pressable>
        ) : (
          <View />
        )}
        {step < 3 ? (
          <GradientButton
            title="Continue"
            onPress={next}
            style={{ flex: 1, marginLeft: step > 1 ? spacing.sm : 0 }}
          />
        ) : (
          <GradientButton
            title={submitting ? 'Submitting…' : 'Submit for review'}
            loading={submitting}
            onPress={handleSubmit}
            style={{ flex: 1, marginLeft: spacing.sm }}
          />
        )}
      </View>
    </View>
  );
}

// --- Step 1 ---------------------------------------------------------------

function Step1({ form, set, setLocation, errors, countries, flatCities, typeCat, verifiedPhone }) {
  const phoneLocked = Boolean(verifiedPhone);
  const subOptions =
    typeCat && Array.isArray(typeCat.subCategories)
      ? typeCat.subCategories.map((s) => ({ value: s.id, label: s.name }))
      : [];

  return (
    <View>
      <SectionLabel>Profile photo</SectionLabel>
      <PhotoUpload
        value={form.profilePhoto}
        onChange={(url) => set('profilePhoto', url)}
        category="profile_photo"
      />

      <SectionLabel>Personal</SectionLabel>
      <Row>
        <AuthInput
          label="First name"
          icon="user"
          autoCapitalize="words"
          value={form.firstName}
          onChangeText={(v) => set('firstName', v)}
          error={errors.firstName}
        />
        <AuthInput
          label="Last name"
          icon="user"
          autoCapitalize="words"
          value={form.lastName}
          onChangeText={(v) => set('lastName', v)}
          error={errors.lastName}
        />
      </Row>
      <AuthInput
        label="Email"
        icon="mail"
        keyboardType="email-address"
        value={form.email}
        onChangeText={(v) => set('email', v)}
        error={errors.email}
      />
      {phoneLocked ? (
        <VerifiedPhoneDisplay phone={form.mobileNumber} />
      ) : (
        <AuthInput
          label="Mobile number"
          icon="smartphone"
          keyboardType="phone-pad"
          placeholder="+91 98xxxxxxxx"
          value={form.mobileNumber}
          onChangeText={(v) => set('mobileNumber', v)}
          error={errors.mobileNumber}
        />
      )}
      <Row>
        <AuthInput
          label="Password"
          icon="lock"
          secureTextEntry
          value={form.password}
          onChangeText={(v) => set('password', v)}
          error={errors.password}
        />
        <AuthInput
          label="Confirm password"
          icon="lock"
          secureTextEntry
          value={form.confirmPassword}
          onChangeText={(v) => set('confirmPassword', v)}
          error={errors.confirmPassword}
        />
      </Row>

      <SectionLabel>Location</SectionLabel>
      <LocationFields
        countries={countries}
        countryId={form.countryId}
        stateId={form.stateId}
        cityId={form.cityId}
        onChange={setLocation}
        errors={errors}
      />

      <SearchableMultiSelect
        label="Practice cities"
        icon="map-pin"
        placeholder="Add every city you take clients in…"
        options={flatCities}
        value={form.practiceCityIds}
        onChange={(v) => set('practiceCityIds', v)}
        hint="Searchable — clients filtering by city will see you for any of these."
      />

      <AuthInput
        label="Address line"
        icon="home"
        autoCapitalize="sentences"
        placeholder="Street, building, area"
        value={form.addressLine}
        onChangeText={(v) => set('addressLine', v)}
      />
      <AuthInput
        label="Short bio"
        icon="edit-3"
        autoCapitalize="sentences"
        placeholder="A brief introduction about your practice."
        value={form.bio}
        onChangeText={(v) => set('bio', v)}
      />

      {subOptions.length > 0 ? (
        <SearchableMultiSelect
          label={`${typeCat.name} sub-categories`}
          hint={`Select every ${typeCat.name.toLowerCase()} area you practise in.`}
          icon="tag"
          options={subOptions}
          value={form.subCategoryIds}
          onChange={(v) => set('subCategoryIds', v)}
          placeholder={`Search ${typeCat.name.toLowerCase()} areas…`}
        />
      ) : null}
    </View>
  );
}

// --- Step 2 ---------------------------------------------------------------

function Step2({ form, set, errors, isLegal }) {
  return (
    <View>
      <SectionLabel>Experience</SectionLabel>
      <Row>
        <AuthInput
          label="Years of experience"
          icon="clock"
          keyboardType="numeric"
          placeholder="5"
          value={form.yearsOfExperience}
          onChangeText={(v) => set('yearsOfExperience', v)}
        />
        <AuthInput
          label="Consultation fee (₹)"
          icon="dollar-sign"
          keyboardType="numeric"
          placeholder="1500"
          value={form.consultationFee}
          onChangeText={(v) => set('consultationFee', v)}
        />
      </Row>
      <AuthInput
        label="Skills"
        icon="zap"
        autoCapitalize="words"
        placeholder="Litigation, Drafting"
        hint="Comma-separated"
        value={form.skills}
        onChangeText={(v) => set('skills', v)}
      />
      <AuthInput
        label="Languages"
        icon="globe"
        autoCapitalize="words"
        placeholder="English, Hindi"
        hint="Comma-separated"
        value={form.languages}
        onChangeText={(v) => set('languages', v)}
      />
      <AuthInput
        label="Education"
        icon="book-open"
        autoCapitalize="words"
        placeholder="LLB - Mumbai Univ, LLM - NLU"
        hint="Comma-separated"
        value={form.education}
        onChangeText={(v) => set('education', v)}
      />
      <AuthInput
        label="Certifications"
        icon="check-circle"
        autoCapitalize="words"
        placeholder="Certified Mediator, GST Practitioner"
        hint="Comma-separated"
        value={form.certifications}
        onChangeText={(v) => set('certifications', v)}
      />
      <Row>
        <AuthInput
          label="Website"
          icon="globe"
          placeholder="https://example.com"
          value={form.website}
          onChangeText={(v) => set('website', v)}
        />
        <AuthInput
          label="LinkedIn"
          icon="linkedin"
          placeholder="https://linkedin.com/in/you"
          value={form.linkedin}
          onChangeText={(v) => set('linkedin', v)}
        />
      </Row>
      <AuthInput
        label="Availability"
        icon="calendar"
        placeholder="Mon, Tue, Wed, Fri"
        hint="Comma-separated days or slots"
        value={form.availability}
        onChangeText={(v) => set('availability', v)}
      />

      <SectionLabel>{isLegal ? 'Legal practice' : 'Tax practice'}</SectionLabel>
      {isLegal ? (
        <>
          <AuthInput
            label="Bar registration number"
            icon="hash"
            autoCapitalize="characters"
            placeholder="MAH/1234/2020"
            value={form.barRegistrationNumber}
            onChangeText={(v) => set('barRegistrationNumber', v)}
            error={errors.barRegistrationNumber}
          />
          <AuthInput
            label="Enrollment number"
            icon="hash"
            autoCapitalize="characters"
            placeholder="ENR-56789"
            value={form.enrollmentNumber}
            onChangeText={(v) => set('enrollmentNumber', v)}
            error={errors.enrollmentNumber}
          />
          <AuthInput
            label="Advocate license number"
            icon="hash"
            autoCapitalize="characters"
            value={form.advocateLicenseNumber}
            onChangeText={(v) => set('advocateLicenseNumber', v)}
          />
          <AuthInput
            label="Practice areas"
            icon="tag"
            autoCapitalize="words"
            placeholder="Civil, Family, Tax"
            hint="Comma-separated"
            value={form.practiceAreas}
            onChangeText={(v) => set('practiceAreas', v)}
          />
          <AuthInput
            label="Courts you practice in"
            icon="briefcase"
            autoCapitalize="words"
            placeholder="Bombay HC, Delhi HC"
            hint="Comma-separated"
            value={form.courtPractice}
            onChangeText={(v) => set('courtPractice', v)}
          />
          <AuthInput
            label="Jurisdiction"
            icon="globe"
            autoCapitalize="words"
            placeholder="Bombay High Court"
            value={form.jurisdiction}
            onChangeText={(v) => set('jurisdiction', v)}
          />
          <AuthInput
            label="Chamber address"
            icon="home"
            autoCapitalize="sentences"
            value={form.chamberAddress}
            onChangeText={(v) => set('chamberAddress', v)}
          />
          <Row>
            <AuthInput
              label="Law degree"
              icon="book-open"
              autoCapitalize="words"
              placeholder="LLB"
              value={form.lawDegree}
              onChangeText={(v) => set('lawDegree', v)}
            />
            <AuthInput
              label="Years of practice"
              icon="clock"
              keyboardType="numeric"
              value={form.yearsOfPractice}
              onChangeText={(v) => set('yearsOfPractice', v)}
            />
          </Row>
          <ChoiceRow
            label="Consultation mode"
            value={form.legalConsultationType}
            options={CONSULTATION_OPTIONS}
            onChange={(v) => set('legalConsultationType', v)}
          />
        </>
      ) : (
        <>
          <AuthInput
            label="Tax registration number"
            icon="hash"
            autoCapitalize="characters"
            placeholder="TAN/PAN"
            value={form.taxRegistrationNumber}
            onChangeText={(v) => set('taxRegistrationNumber', v)}
            error={errors.taxRegistrationNumber}
          />
          <AuthInput
            label="Specialization areas"
            icon="tag"
            autoCapitalize="words"
            placeholder="GST, Income Tax, Audit"
            hint="Comma-separated"
            value={form.specializationAreas}
            onChangeText={(v) => set('specializationAreas', v)}
          />
          <Text style={styles.subLabel}>Expertise</Text>
          <View style={styles.checkboxList}>
            <CheckboxRow label="GST expertise" value={form.gstExpertise} onChange={(v) => set('gstExpertise', v)} />
            <CheckboxRow label="Income tax expertise" value={form.incomeTaxExpertise} onChange={(v) => set('incomeTaxExpertise', v)} />
            <CheckboxRow label="Corporate tax expertise" value={form.corporateTaxExpertise} onChange={(v) => set('corporateTaxExpertise', v)} />
            <CheckboxRow label="Business advisory" value={form.businessAdvisory} onChange={(v) => set('businessAdvisory', v)} />
            <CheckboxRow label="Accounting services" value={form.accountingServices} onChange={(v) => set('accountingServices', v)} />
            <CheckboxRow label="Financial planning" value={form.financialPlanning} onChange={(v) => set('financialPlanning', v)} />
          </View>
          <ChoiceRow
            label="Consultation mode"
            value={form.taxConsultationType}
            options={CONSULTATION_OPTIONS}
            onChange={(v) => set('taxConsultationType', v)}
          />
        </>
      )}
    </View>
  );
}

// --- Step 3 ---------------------------------------------------------------

function Step3({ form, set, isLegal }) {
  return (
    <View>
      <Text style={styles.stepHint}>
        Upload identification and certificates. All documents are optional at
        signup — you can add or replace them later from your profile.
      </Text>

      <SectionLabel>Identity</SectionLabel>
      <DocSlot
        label="Government ID"
        hint="Aadhaar, passport or other government-issued ID."
        category="identity_document"
        value={form.governmentId}
        onChange={(url) => set('governmentId', url)}
      />

      <SectionLabel>
        {isLegal ? 'Legal credentials' : 'Tax credentials'}
      </SectionLabel>
      {isLegal ? (
        <>
          <DocSlot
            label="Advocate license"
            value={form.advocateLicense}
            onChange={(url) => set('advocateLicense', url)}
          />
          <DocSlot
            label="Bar council registration certificate"
            value={form.barCouncilRegistration}
            onChange={(url) => set('barCouncilRegistration', url)}
          />
          <DocSlot
            label="Law degree certificate"
            value={form.lawDegreeDocument}
            onChange={(url) => set('lawDegreeDocument', url)}
          />
        </>
      ) : (
        <>
          <DocSlot
            label="Tax registration certificate"
            value={form.taxConsultantCertificate}
            onChange={(url) => set('taxConsultantCertificate', url)}
          />
          <DocSlot
            label="Professional qualification certificate"
            value={form.registrationCertificate}
            onChange={(url) => set('registrationCertificate', url)}
          />
          <DocSlot
            label="Professional license"
            value={form.professionalLicense}
            onChange={(url) => set('professionalLicense', url)}
          />
        </>
      )}

      <Text style={styles.tos}>
        Your profile goes live after our team verifies your details — usually
        within 24–48 hours.
      </Text>
    </View>
  );
}

// ===========================================================================
// Shared building blocks
// ===========================================================================

function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function Row({ children }) {
  return (
    <View style={styles.row2}>
      {children.map((c, i) => (
        <View key={i} style={styles.row2Col}>
          {c}
        </View>
      ))}
    </View>
  );
}

function Banner({ text }) {
  return (
    <View style={styles.banner}>
      <Feather name="alert-circle" size={14} color={colors.dangerSoftText} />
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

// VerifiedPhoneDisplay — pure read-only render of an OTP-verified phone
// number. Used on both client + pro signup so there is literally no
// TextInput in the tree to type into. Visual cue: green check + muted
// background + "Verified via OTP" caption. Users change their number
// from the profile screen post-signup (which has its own re-OTP gate).
function VerifiedPhoneDisplay({ phone }) {
  return (
    <View style={styles.phoneLock}>
      <View style={styles.phoneLockLabelRow}>
        <Text style={styles.phoneLockLabel}>Mobile number</Text>
        <View style={styles.phoneLockBadge}>
          <Feather name="check" size={10} color={colors.success} />
          <Text style={styles.phoneLockBadgeText}>Verified</Text>
        </View>
      </View>
      <View style={styles.phoneLockField}>
        <Feather
          name="smartphone"
          size={16}
          color={colors.textMuted}
          style={{ marginRight: 8 }}
        />
        <Text style={styles.phoneLockValue} numberOfLines={1}>
          {phone || '—'}
        </Text>
        <Feather name="lock" size={14} color={colors.textMuted} />
      </View>
      <Text style={styles.phoneLockHint}>
        Verified via OTP. Edit later from your profile.
      </Text>
    </View>
  );
}

function ChoiceRow({ label, value, options, onChange }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              style={({ pressed }) => [
                styles.choiceBtn,
                active && styles.choiceBtnActive,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text
                style={[styles.choiceText, active && styles.choiceTextActive]}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ===========================================================================
// Styles
// ===========================================================================

const styles = StyleSheet.create({
  footerText: { fontSize: fontSize.sm, color: colors.textSecondary },
  footerLink: { color: colors.primary, fontWeight: fontWeight.bold },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.md,
  },

  // OTP step footer — split row with "Use a different number" on the
  // left and "Resend code" / cooldown on the right. Both render as
  // proper underlined links so they read as interactive.
  otpFooter: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  linkMuted: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
    textDecorationColor: colors.textSecondary,
  },
  linkAccent: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    textDecorationLine: 'underline',
    textDecorationColor: colors.primary,
  },

  // VerifiedPhoneDisplay — locked phone row used on both client + pro
  // signup. No TextInput in the tree so nothing can be typed into it.
  phoneLock: { marginBottom: spacing.md },
  phoneLockLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  phoneLockLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  phoneLockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  phoneLockBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.success,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  phoneLockField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  phoneLockValue: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  phoneLockHint: {
    marginTop: 4,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  backText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },

  stepHint: {
    marginBottom: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  roleDesc: { marginTop: 2, fontSize: fontSize.xs, color: colors.textSecondary },

  sectionLabel: {
    marginTop: spacing.md,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  subLabel: {
    marginTop: 4,
    marginBottom: 4,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  checkboxList: {
    marginBottom: spacing.md,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  banner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: colors.dangerSoft,
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  bannerText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.dangerSoftText,
    lineHeight: 18,
  },

  row2: { flexDirection: 'row', gap: spacing.sm },
  row2Col: { flex: 1 },

  choiceLabel: {
    marginBottom: 6,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  choiceRow: { flexDirection: 'row', gap: 6 },
  choiceBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  choiceBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  choiceText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
  choiceTextActive: { color: colors.primarySoftText },

  navRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  prevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  prevBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },

  tos: {
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: fontSize.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },

  successWrap: { alignItems: 'center', paddingVertical: spacing.md },
  successRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  successBody: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
