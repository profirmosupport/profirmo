import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import AuthShell from '../../components/auth/AuthShell';
import AuthInput, { InlineLink } from '../../components/auth/AuthInput';
import GradientButton from '../../components/auth/GradientButton';
import AuthIllustration from '../../components/auth/AuthIllustration';
import SkipButton from '../../components/auth/SkipButton';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

// LoginScreen — email + password only. Matches the web's Email tab
// styling without the Phone OTP tab (phone sign-in needs Firebase
// reCAPTCHA which doesn't work inside Expo Go).

export default function LoginScreen({ navigation }) {
  const { login, enterGuest } = useAuth();
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
    } catch (err) {
      setBanner(err.message || 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

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
      {banner ? (
        <View style={styles.banner}>
          <Feather name="alert-circle" size={14} color={colors.dangerSoftText} />
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
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
    </AuthShell>
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
});
