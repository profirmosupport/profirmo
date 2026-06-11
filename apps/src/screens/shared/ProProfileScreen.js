// ProProfileScreen — 3-tab professional profile editor that renders
// the EXACT same Step1/Step2/Step3 components the signup wizard uses,
// just prefilled from the user's existing profile + saving via
// /api/profile (personal) and /api/profile/professional (details +
// documents). One source of truth for both flows — see Step1, Step2,
// Step3 in SignupScreen.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import ScreenContainer from '../../components/common/ScreenContainer';
import AuthInput from '../../components/auth/AuthInput';
import GradientButton from '../../components/auth/GradientButton';
import {
  Step1,
  Step2,
  Step3,
  useLocations,
  useCategories,
  flatCityOptions,
  categoryForType,
} from '../auth/SignupScreen';
import { useAuth } from '../../contexts/AuthContext';
import {
  getMyProfile,
  updateMyProfile,
  updateMyProfessionalProfile,
} from '../../services/profileService';
import {
  changePhone,
  sendPhoneOtp,
  verifyPhoneOtp,
} from '../../services/authService';
import { displayName } from '../../utils/formatters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const TABS = ['Personal', 'Details', 'Documents'];

// Same default form shape the signup wizard owns. Profile prefills
// supply the populated fields; everything else stays at empty string
// / array so the Step components don't need any defensive `?? ''`
// scattered through their JSX.
function blankForm() {
  return {
    profilePhoto: '',
    firstName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
    password: '',
    confirmPassword: '',
    countryId: '',
    stateId: '',
    cityId: '',
    practiceCityIds: [],
    addressLine: '',
    bio: '',
    subCategoryIds: [],
    yearsOfExperience: '',
    consultationFee: '',
    skills: '',
    languages: '',
    education: '',
    certifications: '',
    website: '',
    linkedin: '',
    availability: '',
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
    taxRegistrationNumber: '',
    specializationAreas: '',
    gstExpertise: false,
    incomeTaxExpertise: false,
    corporateTaxExpertise: false,
    businessAdvisory: false,
    accountingServices: false,
    financialPlanning: false,
    taxConsultationType: 'Online',
    governmentId: '',
    advocateLicense: '',
    barCouncilRegistration: '',
    lawDegreeDocument: '',
    taxConsultantCertificate: '',
    registrationCertificate: '',
    professionalLicense: '',
  };
}

export default function ProProfileScreen({ navigation }) {
  const { user, refresh } = useAuth();
  const { countries } = useLocations();
  const cats = useCategories();
  const flatCities = useMemo(() => flatCityOptions(countries), [countries]);

  const [tab, setTab] = useState(0);
  const [form, setForm] = useState(blankForm());
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState({ text: '', tone: 'error' });
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingDocs, setSavingDocs] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);

  // The wizard's Step1 expects `typeCat` (the Legal or Tax category
  // record) so the sub-category multi-select can render. Resolve it
  // from the user's stored professionalType on the profile payload.
  const [professionalType, setProfessionalType] = useState('');
  const typeCat = useMemo(
    () => categoryForType(cats, professionalType),
    [cats, professionalType]
  );
  const isLegal = professionalType === 'Legal Consultant';

  const set = useCallback((k, v) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    setErrors((p) => (p[k] ? { ...p, [k]: undefined } : p));
    setBanner((b) => (b.text ? { text: '', tone: 'error' } : b));
  }, []);

  const setLocation = useCallback((next) => {
    setForm((prev) => ({ ...prev, ...next }));
    setErrors((p) => ({
      ...p,
      country: undefined,
      state: undefined,
      city: undefined,
    }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data = null;
      try {
        data = await getMyProfile();
      } catch {
        // Fall back to the AuthContext user so name + email still
        // surface even if /api/profile is unreachable (auth blip,
        // network down, etc.) — same defensive path the client
        // profile takes.
        data = null;
      }
      const u =
        (data && (data.user || data)) ||
        (user
          ? {
              profilePhoto: user.profilePhoto,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              mobileNumber: user.mobileNumber,
            }
          : {});
      const addr = (data && data.address) || {};
      const pd = (data && data.professionalDetail) || {};
      setProfessionalType(pd.professionalType || '');
      setForm((prev) => ({
        ...prev,
        profilePhoto: u.profilePhoto || '',
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        email: u.email || '',
        mobileNumber: u.mobileNumber || '',
        addressLine: addr.addressLine || '',
        bio: pd.bio || pd.about || '',
        // Carry the address names through; the next effect resolves
        // them to country/state/city ids once `countries` lands.
        _addressNames: {
          country: addr.country,
          state: addr.state,
          city: addr.city,
          countryId: addr.countryId,
          stateId: addr.stateId,
          cityId: addr.cityId,
        },
        // Professional details
        subCategoryIds: Array.isArray(pd.subCategoryIds)
          ? pd.subCategoryIds
          : [],
        practiceCityIds: Array.isArray(pd.practiceCities)
          ? pd.practiceCities
          : [],
        yearsOfExperience: pd.yearsOfExperience
          ? String(pd.yearsOfExperience)
          : '',
        consultationFee: pd.consultationFee
          ? String(pd.consultationFee)
          : '',
        skills: Array.isArray(pd.skills)
          ? pd.skills.join(', ')
          : pd.skills || '',
        languages: Array.isArray(pd.languages)
          ? pd.languages.join(', ')
          : pd.languages || '',
        education: Array.isArray(pd.education)
          ? pd.education.join(', ')
          : pd.education || '',
        certifications: Array.isArray(pd.certifications)
          ? pd.certifications.join(', ')
          : pd.certifications || '',
        website: pd.website || '',
        linkedin: pd.linkedin || '',
        availability: pd.availability || '',
        // Legal-specific
        barRegistrationNumber: pd.barRegistrationNumber || '',
        enrollmentNumber: pd.enrollmentNumber || '',
        advocateLicenseNumber: pd.advocateLicenseNumber || '',
        courtPractice: pd.courtsPracticing || '',
        jurisdiction: pd.jurisdiction || '',
        chamberAddress: pd.chamberAddress || '',
        lawDegree: pd.lawDegree || '',
        legalConsultationType:
          pd.consultancyType || prev.legalConsultationType,
        // Tax-specific
        taxRegistrationNumber: pd.taxRegistrationNumber || '',
        specializationAreas: Array.isArray(pd.specializationAreas)
          ? pd.specializationAreas.join(', ')
          : pd.specializationAreas || '',
        gstExpertise: !!pd.gstExpertise,
        incomeTaxExpertise: !!pd.incomeTaxExpertise,
        corporateTaxExpertise: !!pd.corporateTaxExpertise,
        businessAdvisory: !!pd.businessAdvisory,
        accountingServices: !!pd.accountingServices,
        financialPlanning: !!pd.financialPlanning,
        taxConsultationType: pd.consultancyType || prev.taxConsultationType,
        // Documents
        governmentId: pd.identityDocument || '',
        advocateLicense: pd.licenseDocument || '',
        barCouncilRegistration: pd.barCouncilRegistration || '',
        lawDegreeDocument: pd.lawDegreeDocument || '',
        taxConsultantCertificate: pd.taxConsultantCertificate || '',
        registrationCertificate: pd.registrationCertificate || '',
        professionalLicense: pd.professionalLicense || '',
      }));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Resolve address names → ids once both pieces are loaded.
  useEffect(() => {
    if (!form._addressNames || !countries.length) return;
    const addr = form._addressNames;
    const country = countries.find(
      (c) =>
        c.id === addr.countryId ||
        String(c.name || '').toLowerCase() ===
          String(addr.country || '').toLowerCase()
    );
    const state =
      country &&
      (country.states || []).find(
        (s) =>
          s.id === addr.stateId ||
          String(s.name || '').toLowerCase() ===
            String(addr.state || '').toLowerCase()
      );
    const city =
      state &&
      (state.cities || []).find(
        (ci) =>
          ci.id === addr.cityId ||
          String(ci.name || '').toLowerCase() ===
            String(addr.city || '').toLowerCase()
      );
    setForm((prev) => ({
      ...prev,
      countryId: country ? country.id : '',
      stateId: state ? state.id : '',
      cityId: city ? city.id : '',
      _addressNames: undefined,
    }));
  }, [form._addressNames, countries]);

  // ---- Per-tab save handlers -----------------------------------------

  async function savePersonal() {
    if (savingPersonal) return;
    setSavingPersonal(true);
    setBanner({ text: '', tone: 'error' });
    try {
      const country = countries.find((c) => c.id === form.countryId);
      const state = country?.states?.find((s) => s.id === form.stateId);
      const city = state?.cities?.find((c) => c.id === form.cityId);
      await updateMyProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        profilePhoto: form.profilePhoto || undefined,
        address: {
          country: country ? country.name : undefined,
          state: state ? state.name : undefined,
          city: city ? city.name : undefined,
          addressLine: form.addressLine.trim(),
        },
      });
      // Also save bio + sub-categories + practice cities to the
      // professional detail so Step 1's additional fields persist.
      await updateMyProfessionalProfile({
        bio: form.bio || undefined,
        subCategoryIds: form.subCategoryIds,
        practiceCities: form.practiceCityIds,
      });
      try {
        await refresh();
      } catch {}
      setBanner({ text: 'Personal details saved.', tone: 'success' });
    } catch (err) {
      if (err && err.code === 'EMAIL_ALREADY_REGISTERED') {
        setErrors((p) => ({ ...p, email: err.message }));
      }
      setBanner({
        text: err?.message || 'Could not save your profile.',
        tone: 'error',
      });
    } finally {
      setSavingPersonal(false);
    }
  }

  async function saveDetails() {
    if (savingDetails) return;
    setSavingDetails(true);
    setBanner({ text: '', tone: 'error' });
    try {
      const splitCsv = (s) =>
        s
          ? String(s)
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean)
          : [];
      const base = {
        yearsOfExperience: form.yearsOfExperience
          ? Number(form.yearsOfExperience)
          : undefined,
        consultationFee: form.consultationFee
          ? Number(form.consultationFee)
          : undefined,
        skills: splitCsv(form.skills),
        languages: splitCsv(form.languages),
        education: splitCsv(form.education),
        certifications: splitCsv(form.certifications),
        website: form.website || undefined,
        linkedin: form.linkedin || undefined,
        availability: form.availability || undefined,
      };
      if (isLegal) {
        Object.assign(base, {
          barRegistrationNumber: form.barRegistrationNumber || undefined,
          enrollmentNumber: form.enrollmentNumber || undefined,
          advocateLicenseNumber: form.advocateLicenseNumber || undefined,
          courtsPracticing: form.courtPractice || undefined,
          jurisdiction: form.jurisdiction || undefined,
          chamberAddress: form.chamberAddress || undefined,
          lawDegree: form.lawDegree || undefined,
          consultancyType: form.legalConsultationType,
        });
      } else {
        Object.assign(base, {
          taxRegistrationNumber: form.taxRegistrationNumber || undefined,
          specializationAreas: splitCsv(form.specializationAreas),
          gstExpertise: form.gstExpertise,
          incomeTaxExpertise: form.incomeTaxExpertise,
          corporateTaxExpertise: form.corporateTaxExpertise,
          businessAdvisory: form.businessAdvisory,
          accountingServices: form.accountingServices,
          financialPlanning: form.financialPlanning,
          consultancyType: form.taxConsultationType,
        });
      }
      await updateMyProfessionalProfile(base);
      setBanner({ text: 'Professional details saved.', tone: 'success' });
    } catch (err) {
      setBanner({
        text: err?.message || 'Could not save details.',
        tone: 'error',
      });
    } finally {
      setSavingDetails(false);
    }
  }

  async function saveDocs() {
    if (savingDocs) return;
    setSavingDocs(true);
    setBanner({ text: '', tone: 'error' });
    try {
      await updateMyProfessionalProfile({
        identityDocument: form.governmentId || undefined,
        licenseDocument: form.advocateLicense || undefined,
        barCouncilRegistration: form.barCouncilRegistration || undefined,
        lawDegreeDocument: form.lawDegreeDocument || undefined,
        taxConsultantCertificate: form.taxConsultantCertificate || undefined,
        registrationCertificate: form.registrationCertificate || undefined,
        professionalLicense: form.professionalLicense || undefined,
      });
      setBanner({ text: 'Documents saved.', tone: 'success' });
    } catch (err) {
      setBanner({
        text: err?.message || 'Could not save documents.',
        tone: 'error',
      });
    } finally {
      setSavingDocs(false);
    }
  }

  return (
    <ScreenContainer
      hasNavHeader
      keyboard
      contentStyle={styles.pageContent}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View>
          {/* Tab strip — numbered, same shape as the signup wizard's
              StepProgress widget. */}
          <View style={styles.tabBar}>
            {TABS.map((label, i) => {
              const active = tab === i;
              return (
                <Pressable
                  key={label}
                  onPress={() => setTab(i)}
                  style={({ pressed }) => [
                    styles.tabBtn,
                    active && styles.tabBtnActive,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <View
                    style={[styles.tabNum, active && styles.tabNumActive]}
                  >
                    <Text
                      style={[
                        styles.tabNumText,
                        active && styles.tabNumTextActive,
                      ]}
                    >
                      {i + 1}
                    </Text>
                  </View>
                  <Text
                    style={[styles.tabLabel, active && styles.tabLabelActive]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {banner.text ? (
            <View
              style={[
                styles.banner,
                banner.tone === 'success'
                  ? styles.bannerSuccess
                  : styles.bannerError,
              ]}
            >
              <Feather
                name={
                  banner.tone === 'success' ? 'check-circle' : 'alert-circle'
                }
                size={14}
                color={banner.tone === 'success' ? '#047857' : colors.danger}
              />
              <Text
                style={[
                  styles.bannerText,
                  banner.tone === 'success'
                    ? { color: '#047857' }
                    : { color: colors.danger },
                ]}
              >
                {banner.text}
              </Text>
            </View>
          ) : null}

          {/* The exact same Step components the signup wizard renders. */}
          {tab === 0 ? (
            <>
              <Step1
                form={form}
                set={set}
                setLocation={setLocation}
                errors={errors}
                countries={countries}
                flatCities={flatCities}
                typeCat={typeCat}
                verifiedPhone={form.mobileNumber}
                onChangePhone={() => setPhoneModalOpen(true)}
              />
              <GradientButton
                title={savingPersonal ? 'Saving…' : 'Save personal details'}
                loading={savingPersonal}
                onPress={savePersonal}
                style={{ marginTop: spacing.md }}
              />
            </>
          ) : null}

          {tab === 1 ? (
            <>
              <Step2 form={form} set={set} errors={errors} isLegal={isLegal} />
              <GradientButton
                title={savingDetails ? 'Saving…' : 'Save details'}
                loading={savingDetails}
                onPress={saveDetails}
                style={{ marginTop: spacing.md }}
              />
            </>
          ) : null}

          {tab === 2 ? (
            <>
              <Step3 form={form} set={set} isLegal={isLegal} />
              <GradientButton
                title={savingDocs ? 'Saving…' : 'Save documents'}
                loading={savingDocs}
                onPress={saveDocs}
                style={{ marginTop: spacing.md }}
              />
            </>
          ) : null}
        </View>
      )}

      <PhoneChangeModal
        visible={phoneModalOpen}
        currentPhone={user && user.mobileNumber}
        onClose={() => setPhoneModalOpen(false)}
        onChanged={async () => {
          try {
            await refresh();
          } catch {}
          setPhoneModalOpen(false);
          setBanner({ text: 'Phone number updated.', tone: 'success' });
        }}
      />
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// Phone change modal — duplicate of the client version.
// ---------------------------------------------------------------------

function PhoneChangeModal({ visible, currentPhone, onClose, onChanged }) {
  const [step, setStep] = useState('enter');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setStep('enter');
      setPhone('');
      setCode('');
      setError('');
      setBusy(false);
    }
  }, [visible]);

  async function sendOtp() {
    if (busy) return;
    setError('');
    const trimmed = phone.trim();
    if (!/^\+?\d{8,15}$/.test(trimmed.replace(/[\s-]/g, ''))) {
      setError('Enter a valid phone number with country code.');
      return;
    }
    if (trimmed === String(currentPhone || '').trim()) {
      setError('That is already your current number.');
      return;
    }
    setBusy(true);
    try {
      await sendPhoneOtp(trimmed, 'change-phone');
      setStep('verify');
    } catch (err) {
      if (err && err.code === 'PHONE_ALREADY_REGISTERED') {
        setError(
          'This number is already in use by another account. Try a different number.'
        );
      } else {
        setError(err?.message || 'Could not send the OTP. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndCommit() {
    if (busy) return;
    setError('');
    if (!/^\d{4,8}$/.test(code.trim())) {
      setError('Enter the OTP you received.');
      return;
    }
    setBusy(true);
    try {
      await verifyPhoneOtp(phone.trim(), 'change-phone', code.trim());
      await changePhone(phone.trim());
      onChanged?.();
    } catch (err) {
      if (err && err.code === 'PHONE_ALREADY_REGISTERED') {
        setError(
          'This number was just claimed by another account. Pick a different one.'
        );
      } else {
        setError(err?.message || 'Verification failed.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>
              {step === 'enter' ? 'Change phone number' : 'Verify new number'}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          {step === 'enter' ? (
            <>
              <Text style={styles.modalBody}>
                Enter the new number. We&apos;ll text you a one-time code.
              </Text>
              <AuthInput
                label="New mobile number"
                icon="smartphone"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(v) => {
                  setPhone(v);
                  if (error) setError('');
                }}
                error={error}
              />
              <GradientButton
                title={busy ? 'Sending OTP…' : 'Send OTP'}
                loading={busy}
                onPress={sendOtp}
                style={{ marginTop: spacing.sm }}
              />
            </>
          ) : (
            <>
              <Text style={styles.modalBody}>
                Enter the code sent to{' '}
                <Text style={{ fontWeight: fontWeight.bold }}>{phone}</Text>.
              </Text>
              <AuthInput
                label="Verification code"
                icon="key"
                keyboardType="number-pad"
                value={code}
                onChangeText={(v) => {
                  setCode(v);
                  if (error) setError('');
                }}
                error={error}
              />
              <GradientButton
                title={busy ? 'Verifying…' : 'Verify & save'}
                loading={busy}
                onPress={verifyAndCommit}
                style={{ marginTop: spacing.sm }}
              />
              <Pressable
                onPress={() => setStep('enter')}
                style={styles.modalBack}
                hitSlop={6}
              >
                <Feather name="arrow-left" size={12} color={colors.primary} />
                <Text style={styles.modalBackText}>Edit number</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  pageContent: { paddingTop: spacing.md },
  shellBack: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tab strip
  tabBar: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.md,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabBtnActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  tabNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabNumActive: { backgroundColor: colors.primary },
  tabNumText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  tabNumTextActive: { color: colors.textInverse },
  tabLabel: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  tabLabelActive: { color: colors.primary },

  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  bannerError: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
  bannerSuccess: { backgroundColor: '#d1fae5', borderColor: '#6ee7b7' },
  bannerText: { flex: 1, fontSize: 12, fontWeight: fontWeight.semibold },

  changePhoneBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.sm,
  },
  changePhoneText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },

  logoutBtn: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: '#fff5f5',
  },
  logoutText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.danger,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  modalBody: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  modalBack: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  modalBackText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
});
