// ClientForm — the canonical client form. Used by:
//   - SignupScreen   (mode="signup", calls signup APIs on submit)
//   - ProfileScreen  (mode="edit",   prefilled with the user's data,
//                                    calls updateMyProfile on submit)
//
// EVERY visual element is shared between signup and profile so the
// two pages render identically — same SectionLabels, same Row, same
// AuthInputs, same LocationFields, same GradientButton. The only
// per-mode differences:
//   - signup     shows the password field (only on the legacy /
//                non-phone-OTP path) + a "By continuing..." terms line.
//   - edit       hides password + terms, locks the mobile field
//                behind an OTP-gated Change CTA + shows a saved
//                success banner above the form.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AuthInput from '../AuthInput';
import GradientButton from '../GradientButton';
import PhotoUpload from '../PhotoUpload';
import LocationFields from '../LocationFields';
import { useAuth } from '../../../contexts/AuthContext';
import { listLocations } from '../../../services/appSettingsService';
import { ROLES } from '../../../config/constants';
import {
  colors,
  fontSize,
  fontWeight,
  radius,
  spacing,
} from '../../../theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ClientForm({
  mode = 'signup',
  verifiedPhone,
  initial,
  phoneVerified = false,
  onChangePhone,
  onSave,
  saveLabel,
  banner: bannerProp,
}) {
  const isEdit = mode === 'edit';
  const { signup, signupWithPhone } = useAuth();
  const [countries, setCountries] = useState([]);

  // Phone-first path is only relevant during signup (the OTP-verified
  // number is locked into the form). In edit mode we always show the
  // locked-with-Change phone widget instead, so phoneFirst stays false.
  const phoneFirst = !isEdit && Boolean(verifiedPhone);

  const [form, setForm] = useState(() => ({
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
    ...(initial || {}),
  }));
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listLocations().then(setCountries).catch(() => {});
  }, []);

  // Sync initial → form when the prefill data arrives asynchronously
  // (the profile screen typically passes initial AFTER /api/profile
  // resolves, so the form needs to re-seed on prop change).
  useEffect(() => {
    if (!initial) return;
    setForm((prev) => ({ ...prev, ...initial }));
  }, [initial]);

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
    else if (!EMAIL_RE.test(form.email.trim()))
      next.email = 'Enter a valid email.';
    if (!isEdit && !phoneFirst) {
      if (!form.password) next.password = 'Password is required.';
      else if (form.password.length < 6)
        next.password = 'At least 6 characters.';
    }
    if (!form.countryId) next.country = 'Country is required.';
    if (!form.stateId) next.state = 'State is required.';
    if (!form.cityId) next.city = 'City is required.';
    if (!form.addressLine.trim())
      next.addressLine = 'Address line is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setBanner('');
    setSubmitting(true);
    try {
      const country = countries.find((c) => c.id === form.countryId);
      const state = country?.states?.find((s) => s.id === form.stateId);
      const city = state?.cities?.find((c) => c.id === form.cityId);

      // EDIT mode: hand off to caller (typically updateMyProfile).
      if (isEdit && onSave) {
        try {
          await onSave({
            form,
            country,
            state,
            city,
          });
        } catch (err) {
          // Inline-attach email errors so the field highlights.
          if (err && err.code === 'EMAIL_ALREADY_REGISTERED') {
            setErrors((p) => ({ ...p, email: err.message }));
          }
          setBanner(err?.message || 'Could not save your profile.');
        }
        setSubmitting(false);
        return;
      }

      // SIGNUP mode: hit the appropriate auth endpoint.
      if (phoneFirst) {
        await signupWithPhone({
          phone: verifiedPhone,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          role: ROLES.CLIENT,
        });
        return;
      }
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
      {bannerProp ? <SuccessBanner text={bannerProp} /> : null}
      {banner ? <Banner text={banner} /> : null}

      <SectionLabel first>Profile photo</SectionLabel>
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
        autoCapitalize="none"
        placeholder="you@example.com"
        value={form.email}
        onChangeText={(v) => set('email', v)}
        error={errors.email}
      />

      {isEdit ? (
        <LockedPhoneField
          phone={form.mobileNumber}
          verified={phoneVerified}
          onChangePress={onChangePhone}
        />
      ) : phoneFirst ? (
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

      {!isEdit && !phoneFirst ? (
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
        title={
          submitting
            ? isEdit
              ? 'Saving…'
              : 'Creating account…'
            : saveLabel || (isEdit ? 'Save changes' : 'Create account')
        }
        loading={submitting}
        onPress={handleSubmit}
        style={{ marginTop: spacing.md }}
      />

      {isEdit ? null : (
        <Text style={styles.tos}>
          By continuing you agree to Profirmo&apos;s Terms of Service and
          Privacy Policy.
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------
// Shared subcomponents — single source of truth for both signup + edit.
// ---------------------------------------------------------------------

export function SectionLabel({ children, first }) {
  return (
    <Text style={[styles.sectionLabel, first && { marginTop: 0 }]}>
      {children}
    </Text>
  );
}

export function Row({ children }) {
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

export function Banner({ text }) {
  return (
    <View style={styles.banner}>
      <Feather name="alert-circle" size={14} color={colors.dangerSoftText} />
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

export function SuccessBanner({ text }) {
  return (
    <View style={[styles.banner, styles.bannerSuccess]}>
      <Feather name="check-circle" size={14} color="#047857" />
      <Text style={[styles.bannerText, { color: '#047857' }]}>{text}</Text>
    </View>
  );
}

export function VerifiedPhoneDisplay({ phone }) {
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

// LockedPhoneField — used in EDIT mode. Same visual chrome as the
// signup VerifiedPhoneDisplay, but with a "Change" button instead of
// the static "Edit later from your profile" caption.
export function LockedPhoneField({ phone, verified, onChangePress }) {
  return (
    <View style={styles.phoneLock}>
      <View style={styles.phoneLockLabelRow}>
        <Text style={styles.phoneLockLabel}>Mobile number</Text>
        {verified ? (
          <View style={styles.phoneLockBadge}>
            <Feather name="check" size={10} color={colors.success} />
            <Text style={styles.phoneLockBadgeText}>Verified</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.phoneLockField}>
        <Feather
          name="smartphone"
          size={16}
          color={colors.textMuted}
          style={{ marginRight: 8 }}
        />
        <Text style={styles.phoneLockValue} numberOfLines={1}>
          {phone || 'Not added yet'}
        </Text>
        <Feather name="lock" size={14} color={colors.textMuted} />
      </View>
      <Pressable
        onPress={onChangePress}
        hitSlop={6}
        style={({ pressed }) => [
          styles.changePhoneBtn,
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Feather name="edit-3" size={12} color={colors.primary} />
        <Text style={styles.changePhoneText}>
          {phone ? 'Change number' : 'Add number'}
        </Text>
      </Pressable>
      <Text style={styles.phoneLockHint}>
        Phone changes require OTP verification on the new number.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------
// Styles — copied verbatim from SignupScreen so the visual output is
// pixel-identical between signup and profile.
// ---------------------------------------------------------------------

const styles = StyleSheet.create({
  sectionLabel: {
    marginTop: spacing.md,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  row2: { flexDirection: 'row', gap: spacing.sm },
  row2Col: { flex: 1 },

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
  bannerSuccess: {
    backgroundColor: '#d1fae5',
    borderColor: '#6ee7b7',
  },
  bannerText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.dangerSoftText,
    lineHeight: 18,
  },

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
    marginTop: 6,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  changePhoneBtn: {
    marginTop: 8,
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
  },
  changePhoneText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },

  tos: {
    marginTop: spacing.md,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
