// LoginScreen — two-tab sign-in matching the web's /login page.
//
//   • Phone tab  → Ping4SMS 6-digit OTP. Two sub-steps:
//                   enter-phone → enter-code. Calls /api/auth/phone/...
//                   Resend within the 10-min validity window re-uses
//                   the same code (backend reuses live OTP rows).
//   • Email tab  → plain email + password.
//
// "Skip" button drops the user into the app as a guest (existing flow).

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import AuthShell from '../../components/auth/AuthShell';
import AuthInput, { InlineLink } from '../../components/auth/AuthInput';
import GradientButton from '../../components/auth/GradientButton';
import AuthIllustration from '../../components/auth/AuthIllustration';
import SkipButton from '../../components/auth/SkipButton';
import {
  checkPhone,
  sendPhoneOtp,
  verifyPhoneOtp,
} from '../../services/authService';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const RESEND_COOLDOWN_SECONDS = 300;

// Normalise a user-typed phone into E.164. Indian 10-digit defaults to
// +91; anything starting with + is kept verbatim minus non-digits.
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

function fmtMmSs(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function LoginScreen({ navigation }) {
  const { enterGuest } = useAuth();
  const [tab, setTab] = useState('phone'); // 'phone' | 'email'

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Profirmo account."
      topRight={<SkipButton onPress={enterGuest} />}
      footer={
        <Text style={styles.footerText}>
          New to Profirmo?{' '}
          <Text
            style={styles.footerLink}
            onPress={() => navigation.navigate('Signup')}
          >
            Create an account
          </Text>
        </Text>
      }
      illustration={<AuthIllustration />}
    >
      <View style={styles.tabRow}>
        <TabButton
          icon="smartphone"
          label="Phone OTP"
          active={tab === 'phone'}
          onPress={() => setTab('phone')}
        />
        <TabButton
          icon="mail"
          label="Email"
          active={tab === 'email'}
          onPress={() => setTab('email')}
        />
      </View>

      {tab === 'phone' ? (
        <PhoneTab navigation={navigation} />
      ) : (
        <EmailTab navigation={navigation} />
      )}
    </AuthShell>
  );
}

function TabButton({ icon, label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabBtn,
        active && styles.tabBtnActive,
        pressed && { opacity: 0.9 },
      ]}
    >
      <Feather
        name={icon}
        size={14}
        color={active ? colors.textPrimary : colors.textSecondary}
      />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ===========================================================================
// PhoneTab — enter-phone → enter-code → loginWithPhone
// ===========================================================================

function PhoneTab({ navigation }) {
  const { loginWithPhone } = useAuth();
  const [step, setStep] = useState('enter-phone'); // 'enter-phone' | 'enter-code'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  // The E.164 we sent the OTP to. We verify + login against THIS, not
  // the live `phone` field which the user might edit later.
  const [sentTo, setSentTo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [unregistered, setUnregistered] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // Resend cooldown ticker — runs only while the timer is positive.
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
    setUnregistered(false);
    const e164 = toE164(phone);
    if (!/^\+\d{8,15}$/.test(e164)) {
      setError('Enter a valid phone number including the country code.');
      return;
    }
    setSubmitting(true);
    try {
      // Pre-flight: bounce unregistered numbers to signup before
      // burning an SMS.
      const check = await checkPhone(e164);
      if (!check || !check.exists) {
        setUnregistered(true);
        return;
      }
      await sendPhoneOtp(e164, 'login');
      setSentTo(e164);
      setStep('enter-code');
      setInfo(`We sent a 6-digit code to ${e164}.`);
      setResendIn(RESEND_COOLDOWN_SECONDS);
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
      setStep('enter-phone');
      return;
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter the 6-digit code from the SMS.');
      return;
    }
    setSubmitting(true);
    try {
      // Verify, then redeem.
      await verifyPhoneOtp(sentTo, 'login', otp.trim());
      await loginWithPhone(sentTo);
      // Don't clear `submitting` — the loader stays on until the auth
      // state flip swaps the navigator, taking this screen off the
      // stack. Without this the spinner blinks off between commit and
      // re-render.
      return;
    } catch (err) {
      const code = err && err.payload && err.payload.code;
      setError(
        (err && err.message) ||
          (code === 'OTP_INCORRECT'
            ? 'The code you entered is incorrect.'
            : 'Could not verify the code. It may be wrong or expired.')
      );
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
      await sendPhoneOtp(target, 'login');
      setSentTo(target);
      setInfo(`A new 6-digit code was sent to ${target}.`);
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err.message || 'Could not resend the OTP. Please try again.');
    } finally {
      setResending(false);
    }
  }

  return (
    <View>
      {error ? (
        <Banner tone="danger" icon="alert-circle" text={error} />
      ) : null}
      {info ? <Banner tone="success" icon="check-circle" text={info} /> : null}
      {unregistered ? (
        <View style={styles.unregistered}>
          <Feather name="alert-circle" size={14} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.unregisteredTitle}>
              No account found for this number.
            </Text>
            <Text style={styles.unregisteredText}>
              Sign up first to create a Profirmo account.
            </Text>
            <Pressable
              onPress={() => navigation.navigate('Signup')}
              style={({ pressed }) => [
                styles.unregisteredCta,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.unregisteredCtaText}>Create an account</Text>
              <Feather name="arrow-right" size={13} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {step === 'enter-phone' ? (
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
              if (unregistered) setUnregistered(false);
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
            title={submitting ? 'Verifying…' : 'Verify and sign in'}
            loading={submitting}
            onPress={handleVerifyOtp}
            style={{ marginTop: 6 }}
          />
          <View style={styles.otpFooter}>
            <Pressable
              disabled={submitting}
              onPress={() => {
                setStep('enter-phone');
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
// EmailTab — email + password (the original LoginScreen body)
// ===========================================================================

function EmailTab({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const next = {};
    if (!email.trim()) next.email = 'Email is required.';
    if (!password) next.password = 'Password is required.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBanner('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      // Same loader-stays-on pattern — auth flip swaps the navigator.
      return;
    } catch (err) {
      setBanner(err.message || 'Unable to sign in. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <View>
      {banner ? (
        <Banner tone="danger" icon="alert-circle" text={banner} />
      ) : null}
      <AuthInput
        label="Email address"
        icon="mail"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
        }}
        placeholder="you@example.com"
        keyboardType="email-address"
        error={errors.email}
      />
      <AuthInput
        label="Password"
        icon="lock"
        secureTextEntry
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
        }}
        placeholder="Your password"
        error={errors.password}
        rightAdornment={
          <InlineLink
            text="Forgot password?"
            onPress={() => navigation.navigate('ForgotPassword')}
          />
        }
      />
      <GradientButton
        title={submitting ? 'Signing in…' : 'Sign in'}
        loading={submitting}
        onPress={handleSubmit}
        style={{ marginTop: 6 }}
      />
    </View>
  );
}

// ===========================================================================
// Shared bits
// ===========================================================================

function Banner({ tone, icon, text }) {
  const isDanger = tone === 'danger';
  return (
    <View
      style={[
        styles.banner,
        isDanger ? styles.bannerDanger : styles.bannerSuccess,
      ]}
    >
      <Feather
        name={icon}
        size={14}
        color={isDanger ? colors.dangerSoftText : colors.success}
      />
      <Text
        style={[
          styles.bannerText,
          isDanger
            ? { color: colors.dangerSoftText }
            : { color: colors.success },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footerText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  footerLink: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.md,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.sm,
  },
  tabBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  tabLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  tabLabelActive: { color: colors.textPrimary },

  otpFooter: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkMuted: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  linkAccent: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },

  banner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  bannerDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: '#fecaca',
  },
  bannerSuccess: {
    backgroundColor: colors.successSoft,
    borderColor: '#a7f3d0',
  },
  bannerText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },

  unregistered: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.4)',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  unregisteredTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.warning,
  },
  unregisteredText: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.warning,
  },
  unregisteredCta: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  unregisteredCtaText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
});
