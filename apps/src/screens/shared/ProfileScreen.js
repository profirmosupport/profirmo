// ProfileScreen — mirror of the web /dashboard/{role}/profile page,
// re-using the signup wizard's widgets (AuthInput, PhotoUpload,
// SearchableSelect via LocationFields, GradientButton) so the editor
// reads identically to the create-account form.
//
// Field-level rules:
//   - Name, email, profile photo, address (country/state/city), address
//     line are directly editable. Email is server-checked for uniqueness
//     on save; collisions surface a 409 with code 'EMAIL_ALREADY_REGISTERED'.
//   - Phone number is READ-ONLY in this form. Changing it opens an
//     in-screen OTP modal that:
//       1. POSTs /api/auth/phone/send-otp with purpose='change-phone'
//       2. /api/auth/phone/verify-otp with the same purpose + code
//       3. /api/auth/change-phone to commit the new number (server
//          re-checks the verified flag + uniqueness)
//
// Logout button sits at the bottom; the guest variant offers a sign-in
// CTA so a visitor can convert to a real account in one tap.

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
import LocationFields from '../../components/auth/LocationFields';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../config/constants';
import ProProfileScreen from './ProProfileScreen';
import { getMyProfile, updateMyProfile } from '../../services/profileService';
import {
  changePhone,
  sendPhoneOtp,
  verifyPhoneOtp,
} from '../../services/authService';
import { listLocations } from '../../services/appSettingsService';
import { displayName } from '../../utils/formatters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_OTP_PURPOSE = 'change-phone';

export default function ProfileScreen(props) {
  const { user, isGuest, exitGuest, logout, refresh } = useAuth();

  if (!user && isGuest) {
    return <GuestStateCard onSignIn={exitGuest} />;
  }
  if (!user) return null;
  // Pros get the 3-step tabbed editor (Personal / Details / Documents)
  // so all signup-wizard fields can be edited after onboarding.
  if (user.role === ROLES.PROFESSIONAL) {
    return <ProProfileScreen {...props} />;
  }
  return <SignedInProfile user={user} refresh={refresh} logout={logout} />;
}

// ---------------------------------------------------------------------
// Signed-in editor
// ---------------------------------------------------------------------

function SignedInProfile({ user, refresh, logout }) {
  const [countries, setCountries] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    profilePhoto: '',
    firstName: '',
    lastName: '',
    email: '',
    countryId: '',
    stateId: '',
    cityId: '',
    addressLine: '',
  });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState({ text: '', tone: 'error' });
  const [saving, setSaving] = useState(false);

  // Phone-change modal state.
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);

  // ---- Load profile + locations on mount ----
  useEffect(() => {
    listLocations().then(setCountries).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyProfile();
      const u = (data && (data.user || data)) || {};
      const addr = (data && data.address) || {};
      setProfile(data);
      setForm((prev) => ({
        ...prev,
        profilePhoto: u.profilePhoto || '',
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        email: u.email || '',
        addressLine: addr.addressLine || '',
      }));
    } catch {
      // Fall back to the auth user payload — at least name + email
      // render so the form isn't empty if /api/profile is unreachable.
      setForm((prev) => ({
        ...prev,
        profilePhoto: user.profilePhoto || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
      }));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Resolve countryId/stateId/cityId from saved address names ----
  // Profile addresses come back as name strings (country/state/city), but
  // the editor uses ids. Once `countries` + `profile` are both loaded,
  // walk the tree to seed the cascading dropdowns.
  useEffect(() => {
    if (!profile || !countries.length) return;
    const addr = profile.address || {};
    if (!addr.country && !addr.state && !addr.city) return;
    const country = countries.find(
      (c) =>
        c.id === addr.countryId ||
        String(c.name || '').toLowerCase() === String(addr.country || '').toLowerCase()
    );
    const state =
      country && (country.states || []).find(
        (s) =>
          s.id === addr.stateId ||
          String(s.name || '').toLowerCase() === String(addr.state || '').toLowerCase()
      );
    const city =
      state && (state.cities || []).find(
        (ci) =>
          ci.id === addr.cityId ||
          String(ci.name || '').toLowerCase() === String(addr.city || '').toLowerCase()
      );
    setForm((prev) => ({
      ...prev,
      countryId: country ? country.id : '',
      stateId: state ? state.id : '',
      cityId: city ? city.id : '',
    }));
  }, [profile, countries]);

  const set = (k, v) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
    if (banner.text) setBanner({ text: '', tone: 'error' });
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
    else if (!EMAIL_RE.test(form.email.trim()))
      next.email = 'Enter a valid email.';
    if (!form.countryId) next.country = 'Country is required.';
    if (!form.stateId) next.state = 'State is required.';
    if (!form.cityId) next.city = 'City is required.';
    if (!form.addressLine.trim())
      next.addressLine = 'Address line is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (saving) return;
    if (!validate()) return;
    setSaving(true);
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
      // Pull the fresh user into AuthContext so the rest of the app
      // reflects the new name / email / photo immediately.
      try {
        await refresh();
      } catch {}
      setBanner({ text: 'Profile updated.', tone: 'success' });
    } catch (err) {
      if (err && err.code === 'EMAIL_ALREADY_REGISTERED') {
        setErrors((p) => ({ ...p, email: err.message }));
        setBanner({ text: err.message, tone: 'error' });
      } else {
        setBanner({
          text: err?.message || 'Could not save your profile.',
          tone: 'error',
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenContainer hasNavHeader keyboard contentStyle={styles.pageContent}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          {/* Identity strip */}
          <Card>
            <View style={styles.identityRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.identityName}>{displayName(user)}</Text>
                <Text style={styles.identityEmail}>{user.email}</Text>
                <View style={styles.badges}>
                  {user.role ? (
                    <Badge variant="amber">{user.role}</Badge>
                  ) : null}
                  {user.emailVerified ? (
                    <Badge variant="green">Email verified</Badge>
                  ) : (
                    <Badge variant="gray">Email unverified</Badge>
                  )}
                  {user.mobileVerified ? (
                    <Badge variant="green">Phone verified</Badge>
                  ) : null}
                </View>
              </View>
            </View>
          </Card>

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
                name={banner.tone === 'success' ? 'check-circle' : 'alert-circle'}
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

          {/* Profile photo — its own card so the centred avatar reads
              as a distinct unit instead of bleeding into the form. */}
          <Card>
            <SectionLabel>Profile photo</SectionLabel>
            <PhotoUpload
              value={form.profilePhoto}
              onChange={(url) => set('profilePhoto', url)}
              category="profile_photo"
            />
          </Card>

          {/* Personal */}
          <Card>
            <SectionLabel>Personal</SectionLabel>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <AuthInput
                  label="First name"
                  icon="user"
                  autoCapitalize="words"
                  placeholder="Aarav"
                  value={form.firstName}
                  onChangeText={(v) => set('firstName', v)}
                  error={errors.firstName}
                />
              </View>
              <View style={{ flex: 1 }}>
                <AuthInput
                  label="Last name"
                  icon="user"
                  autoCapitalize="words"
                  placeholder="Mehta"
                  value={form.lastName}
                  onChangeText={(v) => set('lastName', v)}
                  error={errors.lastName}
                />
              </View>
            </View>
            <AuthInput
              label="Email address"
              icon="mail"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@example.com"
              value={form.email}
              onChangeText={(v) => set('email', v)}
              error={errors.email}
              hint="Changing your email will mark it as unverified until you re-confirm."
            />

            {/* Phone — read-only + change CTA */}
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
                {user.mobileVerified ? (
                  <View style={styles.phoneVerified}>
                    <Feather name="check" size={10} color="#047857" />
                    <Text style={styles.phoneVerifiedText}>Verified</Text>
                  </View>
                ) : null}
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

          {/* Location */}
          <Card>
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
          </Card>

          <GradientButton
            title={saving ? 'Saving…' : 'Save changes'}
            loading={saving}
            onPress={handleSave}
          />

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
        currentPhone={user.mobileNumber}
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
// Phone-change OTP modal
// ---------------------------------------------------------------------

function PhoneChangeModal({ visible, currentPhone, onClose, onChanged }) {
  const [step, setStep] = useState('enter'); // 'enter' | 'verify'
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Reset whenever the modal opens.
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
      await sendPhoneOtp(trimmed, PHONE_OTP_PURPOSE);
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
      await verifyPhoneOtp(phone.trim(), PHONE_OTP_PURPOSE, code.trim());
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
                Enter the new phone number. We&apos;ll text you a one-time
                code to confirm you own it.
              </Text>
              <AuthInput
                label="New mobile number"
                icon="smartphone"
                keyboardType="phone-pad"
                placeholder="+91 98xxxxxxxx"
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
                Enter the code we sent to{' '}
                <Text style={{ fontWeight: fontWeight.bold }}>{phone}</Text>.
              </Text>
              <AuthInput
                label="Verification code"
                icon="key"
                keyboardType="number-pad"
                placeholder="6-digit OTP"
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

// ---------------------------------------------------------------------

function SectionLabel({ children, top }) {
  return (
    <Text
      style={[
        styles.sectionLabel,
        top ? { marginTop: spacing.md } : null,
      ]}
    >
      {children}
    </Text>
  );
}

function GuestStateCard({ onSignIn }) {
  return (
    <ScreenContainer hasNavHeader>
      <Card>
        <View style={styles.guestWrap}>
          <View style={styles.guestIcon}>
            <Feather name="user" size={28} color={colors.primary} />
          </View>
          <Text style={styles.guestTitle}>You&apos;re browsing as a guest</Text>
          <Text style={styles.guestBody}>
            Sign in to book consultations, manage cases, track payments and
            access the rest of your account.
          </Text>
          <Pressable
            onPress={onSignIn}
            style={({ pressed }) => [
              styles.guestCta,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.guestCtaText}>Sign in</Text>
          </Pressable>
        </View>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Breathing room below the dark nav header so the first card
  // doesn't crowd the title bar.
  pageContent: { paddingTop: spacing.lg },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl },

  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  phoneVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#d1fae5',
  },
  phoneVerifiedText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#047857',
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

  banner: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  bannerError: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  bannerSuccess: {
    backgroundColor: '#d1fae5',
    borderColor: '#6ee7b7',
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
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

  // Phone-change modal
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

  // Guest empty state
  guestWrap: { alignItems: 'center', paddingVertical: spacing.md },
  guestIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  guestTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  guestBody: {
    marginTop: 6,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  guestCta: {
    marginTop: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  guestCtaText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
});
