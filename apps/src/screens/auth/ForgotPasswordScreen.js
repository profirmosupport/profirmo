// ForgotPasswordScreen — three-step wizard:
//   1. request → POST /api/auth/forgot-password   (email / phone)
//   2. verify  → POST /api/auth/verify-password-otp (returns resetToken)
//   3. set     → POST /api/auth/reset-password    (new + confirm)
// State is kept in this one component so the user never crosses screens
// mid-flow; navigation lands them back on Login after a successful reset.
//
// Mirrors the web's /forgot-password + /reset-password pages: same
// endpoints, same identifier shape (email OR phone), same resetToken
// hand-off between step 2 and step 3.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AuthShell from '../../components/auth/AuthShell';
import AuthInput from '../../components/auth/AuthInput';
import GradientButton from '../../components/auth/GradientButton';
import {
  forgotPassword,
  verifyPasswordOtp,
  resendPasswordOtp,
  resetPassword,
} from '../../services/authService';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const RESEND_COOLDOWN_SECONDS = 60;

const STEP = {
  REQUEST: 'request',
  VERIFY: 'verify',
  SET: 'set',
  DONE: 'done',
};

export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState(STEP.REQUEST);

  // Identifier captured at step 1; replayed at step 2 + step 3.
  const [identifier, setIdentifier] = useState('');

  // Step 2: OTP + resetToken handed back by the verify call.
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');

  // Step 3: new password + confirm.
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Banners + per-step submitting flags.
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Resend cooldown — backend enforces a 60s server-side floor; mirror
  // it client-side so the button shows the countdown instead of just
  // failing.
  const [resendIn, setResendIn] = useState(0);
  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  async function submitRequest() {
    const cleaned = identifier.trim();
    if (!cleaned) {
      setError('Enter your email or mobile number first.');
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await forgotPassword(cleaned);
      setStep(STEP.VERIFY);
      setMessage(
        "If that account exists we've sent a 6-digit code. Check your email or SMS — codes expire in 15 minutes."
      );
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err?.message || 'Could not start the password reset.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitVerify() {
    const code = otp.trim();
    if (!code || code.length < 4) {
      setError('Enter the 6-digit code from the email / SMS.');
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const res = await verifyPasswordOtp(identifier.trim(), code);
      const token = (res && (res.resetToken || res.token)) || '';
      if (!token) {
        setError('Server did not return a reset token. Try again.');
        return;
      }
      setResetToken(token);
      setStep(STEP.SET);
      setMessage('Code verified. Set a new password below.');
    } catch (err) {
      setError(err?.message || 'Could not verify the code.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitResend() {
    if (resendIn > 0 || submitting) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await resendPasswordOtp(identifier.trim());
      setMessage('A new code has been sent.');
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err?.message || 'Could not resend the code.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSet() {
    const np = newPassword;
    const cp = confirmPassword;
    if (!np || np.length < 8) {
      setError('Pick a password at least 8 characters long.');
      return;
    }
    if (np !== cp) {
      setError('The two passwords do not match.');
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await resetPassword({
        resetToken,
        newPassword: np,
        confirmPassword: cp,
      });
      setStep(STEP.DONE);
      setMessage('Your password has been reset. Sign in with the new one.');
    } catch (err) {
      setError(err?.message || 'Could not set the new password.');
    } finally {
      setSubmitting(false);
    }
  }

  const stepCopy = (() => {
    if (step === STEP.REQUEST) {
      return {
        title: 'Reset your password',
        subtitle:
          "Enter your email or mobile number and we'll send a 6-digit code.",
      };
    }
    if (step === STEP.VERIFY) {
      return {
        title: 'Enter the code',
        subtitle: `Sent to ${identifier.trim()}. Codes expire in 15 minutes.`,
      };
    }
    if (step === STEP.SET) {
      return {
        title: 'Pick a new password',
        subtitle: 'At least 8 characters. Avoid anything you use elsewhere.',
      };
    }
    return {
      title: 'Password reset',
      subtitle: 'You can now sign in with the new password.',
    };
  })();

  return (
    <AuthShell
      title={stepCopy.title}
      subtitle={stepCopy.subtitle}
      footer={
        <Pressable
          onPress={() => navigation.navigate('Login')}
          hitSlop={8}
        >
          <Text style={styles.footerLink}>Back to sign in</Text>
        </Pressable>
      }
    >
      <StepIndicator step={step} />

      {error ? (
        <View style={styles.bannerErr}>
          <Feather name="alert-circle" size={14} color={colors.dangerSoftText} />
          <Text style={[styles.bannerText, { color: colors.dangerSoftText }]}>
            {error}
          </Text>
        </View>
      ) : null}
      {message ? (
        <View style={styles.bannerOk}>
          <Feather name="check-circle" size={14} color={colors.successSoftText} />
          <Text style={[styles.bannerText, { color: colors.successSoftText }]}>
            {message}
          </Text>
        </View>
      ) : null}

      {step === STEP.REQUEST ? (
        <>
          <AuthInput
            label="Email or mobile number"
            icon="mail"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="you@example.com or +91…"
            value={identifier}
            onChangeText={setIdentifier}
          />
          <GradientButton
            title={submitting ? 'Sending…' : 'Send reset code'}
            loading={submitting}
            onPress={submitRequest}
          />
        </>
      ) : null}

      {step === STEP.VERIFY ? (
        <>
          <AuthInput
            label="6-digit code"
            icon="hash"
            keyboardType="number-pad"
            placeholder="123456"
            value={otp}
            onChangeText={(v) =>
              // Strip non-digits live so paste-from-SMS works even when
              // the autofill inserts trailing whitespace.
              setOtp(String(v || '').replace(/\D+/g, '').slice(0, 8))
            }
            maxLength={8}
          />
          <GradientButton
            title={submitting ? 'Verifying…' : 'Verify code'}
            loading={submitting}
            onPress={submitVerify}
          />
          <View style={styles.resendRow}>
            <Pressable
              onPress={submitResend}
              disabled={resendIn > 0 || submitting}
              hitSlop={8}
            >
              <Text
                style={[
                  styles.linkBtn,
                  (resendIn > 0 || submitting) && { color: colors.textMuted },
                ]}
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setStep(STEP.REQUEST);
                setOtp('');
                setError('');
                setMessage('');
              }}
              hitSlop={8}
            >
              <Text style={styles.linkBtn}>Use a different account</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {step === STEP.SET ? (
        <>
          <AuthInput
            label="New password"
            icon="lock"
            secureTextEntry
            placeholder="At least 8 characters"
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <AuthInput
            label="Confirm new password"
            icon="lock"
            secureTextEntry
            placeholder="Repeat the new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <GradientButton
            title={submitting ? 'Saving…' : 'Set new password'}
            loading={submitting}
            onPress={submitSet}
          />
        </>
      ) : null}

      {step === STEP.DONE ? (
        <GradientButton
          title="Sign in"
          onPress={() => navigation.navigate('Login')}
        />
      ) : null}
    </AuthShell>
  );
}

function StepIndicator({ step }) {
  const order = [STEP.REQUEST, STEP.VERIFY, STEP.SET];
  const current = order.indexOf(step === STEP.DONE ? STEP.SET : step);
  return (
    <View style={styles.stepperRow}>
      {order.map((k, i) => {
        const past = i < current || step === STEP.DONE;
        const active = i === current && step !== STEP.DONE;
        return (
          <View key={k} style={styles.stepperItem}>
            <View
              style={[
                styles.stepperDot,
                past
                  ? styles.stepperDotPast
                  : active
                    ? styles.stepperDotActive
                    : null,
              ]}
            >
              {past ? (
                <Feather name="check" size={11} color="#ffffff" />
              ) : (
                <Text
                  style={[
                    styles.stepperDotText,
                    active ? styles.stepperDotTextActive : null,
                  ]}
                >
                  {i + 1}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.stepperLabel,
                (past || active) && styles.stepperLabelActive,
              ]}
            >
              {k === STEP.REQUEST
                ? 'Request'
                : k === STEP.VERIFY
                  ? 'Verify'
                  : 'Reset'}
            </Text>
            {i < order.length - 1 ? (
              <View
                style={[
                  styles.stepperConnector,
                  past ? styles.stepperConnectorPast : null,
                ]}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bannerErr: {
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
  bannerOk: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: colors.successSoft,
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  bannerText: { flex: 1, fontSize: fontSize.sm, lineHeight: 18 },
  footerLink: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.sm,
  },
  resendRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkBtn: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.sm,
  },

  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: 2,
  },
  stepperItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepperDotPast: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  stepperDotText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  stepperDotTextActive: { color: '#ffffff' },
  stepperLabel: {
    marginLeft: 6,
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
  },
  stepperLabelActive: {
    color: colors.textPrimary,
  },
  stepperConnector: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 6,
  },
  stepperConnectorPast: {
    backgroundColor: '#10b981',
  },
});
