// ProProfileScreen — 3-tab professional profile editor, modelled on the
// signup wizard's three steps (Personal / Details / Documents) so a pro
// can edit any registration field after onboarding.
//
//   Tab 1 — Personal     reuses the same widgets as the client profile
//                        (name, email, OTP-gated phone, address, photo).
//   Tab 2 — Details      designation, organization, years of experience,
//                        consultation fee, bio, languages, website.
//                        Saves via PUT /api/profile/professional.
//   Tab 3 — Documents    identity / license / certification uploads
//                        (same DocSlot widget the signup wizard uses).

import { useCallback, useEffect, useState } from 'react';
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
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import AuthInput from '../../components/auth/AuthInput';
import GradientButton from '../../components/auth/GradientButton';
import PhotoUpload from '../../components/auth/PhotoUpload';
import DocSlot from '../../components/auth/DocSlot';
import LocationFields from '../../components/auth/LocationFields';
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
import { listLocations } from '../../services/appSettingsService';
import { displayName } from '../../utils/formatters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TABS = ['Personal', 'Details', 'Documents'];

export default function ProProfileScreen() {
  const { user, refresh, logout } = useAuth();
  const [tab, setTab] = useState(0);
  const [countries, setCountries] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Personal-tab form state.
  const [personal, setPersonal] = useState({
    profilePhoto: '',
    firstName: '',
    lastName: '',
    email: '',
    countryId: '',
    stateId: '',
    cityId: '',
    addressLine: '',
  });
  const [personalErrors, setPersonalErrors] = useState({});
  const [personalSaving, setPersonalSaving] = useState(false);

  // Details-tab form state.
  const [details, setDetails] = useState({
    designation: '',
    organization: '',
    yearsOfExperience: '',
    consultationFee: '',
    bio: '',
    languages: '',
    website: '',
  });
  const [detailsSaving, setDetailsSaving] = useState(false);

  // Documents-tab state — each slot stores the persisted URL or ''.
  const [docs, setDocs] = useState({
    identityDocument: '',
    licenseDocument: '',
    certifications: '',
  });
  const [docsSaving, setDocsSaving] = useState(false);

  const [banner, setBanner] = useState({ text: '', tone: 'error' });
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);

  useEffect(() => {
    listLocations().then(setCountries).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyProfile();
      const u = (data && (data.user || data)) || {};
      const addr = (data && data.address) || {};
      const pd = (data && data.professionalDetail) || {};
      setProfile(data);
      setPersonal((prev) => ({
        ...prev,
        profilePhoto: u.profilePhoto || '',
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        email: u.email || '',
        addressLine: addr.addressLine || '',
      }));
      setDetails({
        designation: pd.designation || '',
        organization: pd.organization || '',
        yearsOfExperience: pd.yearsOfExperience
          ? String(pd.yearsOfExperience)
          : '',
        consultationFee: pd.consultationFee
          ? String(pd.consultationFee)
          : '',
        bio: pd.bio || pd.about || '',
        languages: Array.isArray(pd.languages)
          ? pd.languages.join(', ')
          : pd.languages || '',
        website: pd.website || '',
      });
      setDocs({
        identityDocument: pd.identityDocument || '',
        licenseDocument: pd.licenseDocument || '',
        certifications: pd.certificationsDocuments || pd.certifications || '',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Resolve saved address names → ids once locations are loaded.
  useEffect(() => {
    if (!profile || !countries.length) return;
    const addr = profile.address || {};
    if (!addr.country && !addr.state && !addr.city) return;
    const country = countries.find(
      (c) =>
        c.id === addr.countryId ||
        String(c.name || '').toLowerCase() ===
          String(addr.country || '').toLowerCase()
    );
    const state =
      country && (country.states || []).find(
        (s) =>
          s.id === addr.stateId ||
          String(s.name || '').toLowerCase() ===
            String(addr.state || '').toLowerCase()
      );
    const city =
      state && (state.cities || []).find(
        (ci) =>
          ci.id === addr.cityId ||
          String(ci.name || '').toLowerCase() ===
            String(addr.city || '').toLowerCase()
      );
    setPersonal((prev) => ({
      ...prev,
      countryId: country ? country.id : '',
      stateId: state ? state.id : '',
      cityId: city ? city.id : '',
    }));
  }, [profile, countries]);

  // ---- Personal save ----
  function validatePersonal() {
    const next = {};
    if (!personal.firstName.trim()) next.firstName = 'First name is required.';
    if (!personal.lastName.trim()) next.lastName = 'Last name is required.';
    if (!personal.email.trim()) next.email = 'Email is required.';
    else if (!EMAIL_RE.test(personal.email.trim()))
      next.email = 'Enter a valid email.';
    if (!personal.countryId) next.country = 'Country is required.';
    if (!personal.stateId) next.state = 'State is required.';
    if (!personal.cityId) next.city = 'City is required.';
    if (!personal.addressLine.trim())
      next.addressLine = 'Address line is required.';
    setPersonalErrors(next);
    return Object.keys(next).length === 0;
  }

  async function savePersonal() {
    if (personalSaving) return;
    if (!validatePersonal()) return;
    setPersonalSaving(true);
    setBanner({ text: '', tone: 'error' });
    try {
      const country = countries.find((c) => c.id === personal.countryId);
      const state = country?.states?.find((s) => s.id === personal.stateId);
      const city = state?.cities?.find((c) => c.id === personal.cityId);
      await updateMyProfile({
        firstName: personal.firstName.trim(),
        lastName: personal.lastName.trim(),
        email: personal.email.trim(),
        profilePhoto: personal.profilePhoto || undefined,
        address: {
          country: country ? country.name : undefined,
          state: state ? state.name : undefined,
          city: city ? city.name : undefined,
          addressLine: personal.addressLine.trim(),
        },
      });
      try {
        await refresh();
      } catch {}
      setBanner({ text: 'Personal details saved.', tone: 'success' });
    } catch (err) {
      if (err && err.code === 'EMAIL_ALREADY_REGISTERED') {
        setPersonalErrors((p) => ({ ...p, email: err.message }));
        setBanner({ text: err.message, tone: 'error' });
      } else {
        setBanner({
          text: err?.message || 'Could not save your profile.',
          tone: 'error',
        });
      }
    } finally {
      setPersonalSaving(false);
    }
  }

  // ---- Details save ----
  async function saveDetails() {
    if (detailsSaving) return;
    setDetailsSaving(true);
    setBanner({ text: '', tone: 'error' });
    try {
      const payload = {
        designation: details.designation.trim() || undefined,
        organization: details.organization.trim() || undefined,
        yearsOfExperience: details.yearsOfExperience
          ? Number(details.yearsOfExperience)
          : undefined,
        consultationFee: details.consultationFee
          ? Number(details.consultationFee)
          : undefined,
        bio: details.bio.trim() || undefined,
        website: details.website.trim() || undefined,
        languages: details.languages
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      await updateMyProfessionalProfile(payload);
      setBanner({ text: 'Professional details saved.', tone: 'success' });
    } catch (err) {
      setBanner({
        text: err?.message || 'Could not save details.',
        tone: 'error',
      });
    } finally {
      setDetailsSaving(false);
    }
  }

  // ---- Documents save ----
  async function saveDocs() {
    if (docsSaving) return;
    setDocsSaving(true);
    setBanner({ text: '', tone: 'error' });
    try {
      await updateMyProfessionalProfile({
        identityDocument: docs.identityDocument || undefined,
        licenseDocument: docs.licenseDocument || undefined,
        certificationsDocuments: docs.certifications || undefined,
      });
      setBanner({ text: 'Documents saved.', tone: 'success' });
    } catch (err) {
      setBanner({
        text: err?.message || 'Could not save documents.',
        tone: 'error',
      });
    } finally {
      setDocsSaving(false);
    }
  }

  return (
    <ScreenContainer hasNavHeader keyboard contentStyle={styles.page}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          {/* Identity strip */}
          <Card>
            <Text style={styles.identityName}>{displayName(user)}</Text>
            <Text style={styles.identityEmail}>{user.email}</Text>
            <View style={styles.badges}>
              <Badge variant="amber">{user.role || 'professional'}</Badge>
              {user.emailVerified ? (
                <Badge variant="green">Email verified</Badge>
              ) : (
                <Badge variant="gray">Email unverified</Badge>
              )}
              {user.mobileVerified ? (
                <Badge variant="green">Phone verified</Badge>
              ) : null}
            </View>
          </Card>

          {/* Tab strip — three steps that match the signup wizard. */}
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

          {/* ===== Tab 1 — Personal ===== */}
          {tab === 0 ? (
            <>
              <Card>
                <SectionLabel>Profile photo</SectionLabel>
                <PhotoUpload
                  value={personal.profilePhoto}
                  onChange={(url) =>
                    setPersonal((p) => ({ ...p, profilePhoto: url }))
                  }
                  category="profile_photo"
                />
              </Card>

              <Card>
                <SectionLabel>Personal</SectionLabel>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <AuthInput
                      label="First name"
                      icon="user"
                      autoCapitalize="words"
                      value={personal.firstName}
                      onChangeText={(v) =>
                        setPersonal((p) => ({ ...p, firstName: v }))
                      }
                      error={personalErrors.firstName}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AuthInput
                      label="Last name"
                      icon="user"
                      autoCapitalize="words"
                      value={personal.lastName}
                      onChangeText={(v) =>
                        setPersonal((p) => ({ ...p, lastName: v }))
                      }
                      error={personalErrors.lastName}
                    />
                  </View>
                </View>
                <AuthInput
                  label="Email address"
                  icon="mail"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={personal.email}
                  onChangeText={(v) =>
                    setPersonal((p) => ({ ...p, email: v }))
                  }
                  error={personalErrors.email}
                  hint="Changing your email marks it as unverified."
                />

                <SectionLabel top>Mobile number</SectionLabel>
                <View style={styles.phoneRow}>
                  <View style={styles.phoneField}>
                    <Feather
                      name="smartphone"
                      size={14}
                      color={colors.textMuted}
                    />
                    <Text style={styles.phoneValue}>
                      {user.mobileNumber || 'Not added yet'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setPhoneModalOpen(true)}
                    style={({ pressed }) => [
                      styles.changePhoneBtn,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Feather name="edit-3" size={12} color={colors.primary} />
                    <Text style={styles.changePhoneText}>
                      {user.mobileNumber ? 'Change' : 'Add number'}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.phoneHint}>
                  Phone changes require OTP verification on the new number.
                </Text>
              </Card>

              <Card>
                <SectionLabel>Location</SectionLabel>
                <LocationFields
                  countries={countries}
                  countryId={personal.countryId}
                  stateId={personal.stateId}
                  cityId={personal.cityId}
                  onChange={(next) =>
                    setPersonal((p) => ({ ...p, ...next }))
                  }
                  errors={personalErrors}
                />
                <AuthInput
                  label="Address line"
                  icon="home"
                  value={personal.addressLine}
                  onChangeText={(v) =>
                    setPersonal((p) => ({ ...p, addressLine: v }))
                  }
                  error={personalErrors.addressLine}
                />
              </Card>

              <GradientButton
                title={personalSaving ? 'Saving…' : 'Save personal details'}
                loading={personalSaving}
                onPress={savePersonal}
              />
            </>
          ) : null}

          {/* ===== Tab 2 — Details ===== */}
          {tab === 1 ? (
            <>
              <Card>
                <SectionLabel>Practice</SectionLabel>
                <AuthInput
                  label="Designation"
                  icon="award"
                  placeholder="Senior Advocate / Tax Consultant"
                  value={details.designation}
                  onChangeText={(v) =>
                    setDetails((d) => ({ ...d, designation: v }))
                  }
                />
                <AuthInput
                  label="Organization"
                  icon="briefcase"
                  placeholder="Firm / Chambers / Independent"
                  value={details.organization}
                  onChangeText={(v) =>
                    setDetails((d) => ({ ...d, organization: v }))
                  }
                />
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <AuthInput
                      label="Years of experience"
                      icon="clock"
                      keyboardType="numeric"
                      value={details.yearsOfExperience}
                      onChangeText={(v) =>
                        setDetails((d) => ({
                          ...d,
                          yearsOfExperience: v.replace(/[^0-9]/g, ''),
                        }))
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AuthInput
                      label="Consultation fee (₹)"
                      icon="credit-card"
                      keyboardType="numeric"
                      value={details.consultationFee}
                      onChangeText={(v) =>
                        setDetails((d) => ({
                          ...d,
                          consultationFee: v.replace(/[^0-9]/g, ''),
                        }))
                      }
                    />
                  </View>
                </View>
              </Card>

              <Card>
                <SectionLabel>Profile</SectionLabel>
                <AuthInput
                  label="Bio"
                  icon="edit-3"
                  multiline
                  numberOfLines={5}
                  placeholder="Tell clients about your practice"
                  value={details.bio}
                  onChangeText={(v) => setDetails((d) => ({ ...d, bio: v }))}
                />
                <AuthInput
                  label="Languages"
                  icon="globe"
                  placeholder="English, Hindi, Tamil"
                  value={details.languages}
                  onChangeText={(v) =>
                    setDetails((d) => ({ ...d, languages: v }))
                  }
                  hint="Separate languages with commas."
                />
                <AuthInput
                  label="Website"
                  icon="link"
                  autoCapitalize="none"
                  keyboardType="url"
                  placeholder="https://"
                  value={details.website}
                  onChangeText={(v) =>
                    setDetails((d) => ({ ...d, website: v }))
                  }
                />
              </Card>

              <GradientButton
                title={detailsSaving ? 'Saving…' : 'Save details'}
                loading={detailsSaving}
                onPress={saveDetails}
              />
            </>
          ) : null}

          {/* ===== Tab 3 — Documents ===== */}
          {tab === 2 ? (
            <>
              <Card>
                <SectionLabel>Identity document</SectionLabel>
                <Text style={styles.docHint}>
                  Aadhaar / Passport / PAN — used to verify your identity.
                </Text>
                <DocSlot
                  label="Upload identity document"
                  value={docs.identityDocument}
                  onChange={(url) =>
                    setDocs((d) => ({ ...d, identityDocument: url }))
                  }
                  category="identity_document"
                />
              </Card>

              <Card>
                <SectionLabel>License / Bar enrollment</SectionLabel>
                <Text style={styles.docHint}>
                  Bar council certificate, ICAI / CA license, or equivalent.
                </Text>
                <DocSlot
                  label="Upload license document"
                  value={docs.licenseDocument}
                  onChange={(url) =>
                    setDocs((d) => ({ ...d, licenseDocument: url }))
                  }
                  category="license_document"
                />
              </Card>

              <Card>
                <SectionLabel>Certifications</SectionLabel>
                <Text style={styles.docHint}>
                  Additional certifications or specialisation documents.
                </Text>
                <DocSlot
                  label="Upload certification"
                  value={docs.certifications}
                  onChange={(url) =>
                    setDocs((d) => ({ ...d, certifications: url }))
                  }
                  category="certification"
                />
              </Card>

              <GradientButton
                title={docsSaving ? 'Saving…' : 'Save documents'}
                loading={docsSaving}
                onPress={saveDocs}
              />
            </>
          ) : null}

          <Pressable
            onPress={logout}
            style={({ pressed }) => [
              styles.logoutBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Feather name="log-out" size={14} color={colors.danger} />
            <Text style={styles.logoutText}>Sign out</Text>
          </Pressable>
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
// Phone change modal — identical to the client version. Shared logic
// could be extracted later if a third caller appears.
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

function SectionLabel({ children, top }) {
  return (
    <Text
      style={[styles.sectionLabel, top ? { marginTop: spacing.md } : null]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: spacing.lg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },

  identityName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  identityEmail: {
    marginTop: 2,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  badges: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  // Tab strip
  tabBar: {
    flexDirection: 'row',
    gap: 6,
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

  sectionLabel: {
    marginBottom: 10,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  row: { flexDirection: 'row', gap: spacing.sm },

  // Phone read-only display + change CTA
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  phoneField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  phoneValue: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  changePhoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  changePhoneText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  phoneHint: {
    marginTop: 6,
    fontSize: 11,
    color: colors.textMuted,
  },

  docHint: {
    marginTop: -4,
    marginBottom: 8,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  bannerError: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
  bannerSuccess: { backgroundColor: '#d1fae5', borderColor: '#6ee7b7' },
  bannerText: { flex: 1, fontSize: 12, fontWeight: fontWeight.semibold },

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
