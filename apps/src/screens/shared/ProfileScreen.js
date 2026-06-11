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
import ClientForm from '../../components/auth/forms/ClientForm';
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
  return (
    <SignedInProfile
      user={user}
      refresh={refresh}
      logout={logout}
      navigation={props.navigation}
    />
  );
}

// ---------------------------------------------------------------------
// Signed-in editor
// ---------------------------------------------------------------------

function SignedInProfile({ user, refresh, logout, navigation }) {
  const [countries, setCountries] = useState([]);
  const [initial, setInitial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [successBanner, setSuccessBanner] = useState('');
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);

  // Load /api/profile + locations, resolve address names → ids, and
  // hand the pre-filled snapshot to ClientForm as `initial`.
  useEffect(() => {
    listLocations().then(setCountries).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyProfile();
      const u = (data && (data.user || data)) || {};
      const addr = (data && data.address) || {};
      setInitial({
        profilePhoto: u.profilePhoto || '',
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        email: u.email || '',
        mobileNumber: u.mobileNumber || user.mobileNumber || '',
        addressLine: addr.addressLine || '',
        _addressNames: {
          country: addr.country,
          state: addr.state,
          city: addr.city,
          countryId: addr.countryId,
          stateId: addr.stateId,
          cityId: addr.cityId,
        },
      });
    } catch {
      setInitial({
        profilePhoto: user.profilePhoto || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        mobileNumber: user.mobileNumber || '',
        addressLine: '',
        _addressNames: {},
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Once both countries + initial are loaded, resolve the saved
  // address names back to the cascading-select ids and re-seed the
  // ClientForm prefill.
  const [resolvedInitial, setResolvedInitial] = useState(null);
  useEffect(() => {
    if (!initial) return;
    if (!countries.length || !initial._addressNames) {
      setResolvedInitial({ ...initial, countryId: '', stateId: '', cityId: '' });
      return;
    }
    const addr = initial._addressNames;
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
    setResolvedInitial({
      ...initial,
      countryId: country ? country.id : '',
      stateId: state ? state.id : '',
      cityId: city ? city.id : '',
    });
  }, [initial, countries]);

  // ClientForm calls this with the validated form + resolved country
  // /state/city objects. We translate to the profile-update payload.
  async function handleSave({ form, country, state, city }) {
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
    try {
      await refresh();
    } catch {}
    setSuccessBanner('Profile updated.');
  }

  return (
    <ScreenContainer
      hasNavHeader
      keyboard
      contentStyle={styles.pageContent}
    >
      {loading || !resolvedInitial ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ClientForm
          mode="edit"
          initial={resolvedInitial}
          phoneVerified={user.mobileVerified}
          onChangePhone={() => setPhoneModalOpen(true)}
          onSave={handleSave}
          saveLabel="Save changes"
          banner={successBanner}
        />
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
          setSuccessBanner('Phone number updated.');
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

// Two-up row helper — same shape as the signup wizard's Row so the
// firstName/lastName pair lays out identically.
function Row({ children }) {
  return (
    <View style={styles.row2}>
      {(Array.isArray(children) ? children : [children]).map((c, i) => (
        <View key={i} style={styles.row2Col}>
          {c}
        </View>
      ))}
    </View>
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
  // AuthShell's topRight slot — small X button to dismiss the page
  // since AuthShell has no built-in back button.
  // Breathing room below the dark nav header so the first form
  // field doesn't crowd the title bar.
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

  // Section header — same spacing/typography as the signup wizard so
  // a "Profile photo" / "Personal" / "Location" header reads identically.
  sectionLabel: {
    marginTop: spacing.md,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // Two-up row helper — same as the signup wizard's row2.
  row2: { flexDirection: 'row', gap: spacing.sm },
  row2Col: { flex: 1 },

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
