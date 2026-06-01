import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AuthShell from '../../components/auth/AuthShell';
import AuthInput from '../../components/auth/AuthInput';
import GradientButton from '../../components/auth/GradientButton';
import { forgotPassword } from '../../services/authService';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    if (!email.trim()) {
      setError('Enter your email first.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await forgotPassword(email.trim());
      setMessage(
        "If that email is on file, we've sent a 6-digit code. Complete the reset on the web for now."
      );
    } catch (err) {
      setError(err.message || 'Could not start password reset.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your account email and we'll send a code."
      footer={
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.footerLink}>Back to sign in</Text>
        </Pressable>
      }
    >
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

      <AuthInput
        label="Email address"
        icon="mail"
        keyboardType="email-address"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
      />
      <GradientButton
        title={submitting ? 'Sending…' : 'Send reset email'}
        loading={submitting}
        onPress={submit}
      />
    </AuthShell>
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
  footerLink: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
});
