// GuestSupportScreen — public help & contact surface.
//
// Layout, top → bottom:
//   1. Headline + sub-headline
//   2. Channel tiles  (Email, WhatsApp) — tap-to-open
//   3. Contact form   — name / email / subject / message, posts to
//                       /api/support/contact (same endpoint the web's
//                       /contact page uses)
//
// The web Help-center tile is intentionally absent — the live mobile
// contact form takes its place at the bottom of the channels list.

import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import { submitContact } from '../../services/supportService';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

// E.164-stripped WhatsApp number — wa.me requires digits only.
const WHATSAPP_NUMBER_DISPLAY = '+91 93108 19195';
const WHATSAPP_NUMBER_DIGITS = '919310819195';

const CHANNELS = [
  {
    key: 'email',
    icon: 'mail',
    title: 'Email support',
    body: 'support@profirmo.com',
    href: 'mailto:support@profirmo.com',
  },
  {
    key: 'whatsapp',
    icon: 'message-circle',
    title: 'WhatsApp',
    body: WHATSAPP_NUMBER_DISPLAY,
    href: `https://wa.me/${WHATSAPP_NUMBER_DIGITS}`,
  },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function GuestSupportScreen() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
    if (submitted) setSubmitted(false);
    if (submitError) setSubmitError('');
  }

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = 'Tell us who to reply to.';
    if (!form.email.trim()) {
      next.email = 'Email is required.';
    } else if (!EMAIL_REGEX.test(form.email.trim())) {
      next.email = 'Enter a valid email address.';
    }
    if (!form.subject.trim()) next.subject = 'Add a short subject.';
    if (!form.message.trim()) next.message = 'Write your message.';
    return next;
  }

  async function handleSubmit() {
    if (submitting) return;
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setSubmitted(false);
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      await submitContact(form);
      setSubmitted(true);
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setSubmitError(
        err?.message || 'Could not send your message. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer hasNavHeader keyboard>
      <Text style={styles.title}>How can we help?</Text>
      <Text style={styles.subhead}>
        We typically reply within 24 hours on business days.
      </Text>

      {/* Channels */}
      <View style={styles.channels}>
        {CHANNELS.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => Linking.openURL(c.href).catch(() => {})}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Card>
              <View style={styles.row}>
                <View style={styles.iconBubble}>
                  <Feather name={c.icon} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{c.title}</Text>
                  <Text style={styles.rowBody}>{c.body}</Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={16}
                  color={colors.textMuted}
                />
              </View>
            </Card>
          </Pressable>
        ))}
      </View>

      {/* Contact form — same endpoint as the web /contact page. */}
      <Card style={styles.formCard}>
        <Text style={styles.formTitle}>Send us a message</Text>
        <Text style={styles.formSubtitle}>
          We&apos;ll route your message to the right team and reply by
          email.
        </Text>

        {submitted ? (
          <View style={styles.successBox}>
            <Feather name="check-circle" size={16} color="#047857" />
            <View style={{ flex: 1 }}>
              <Text style={styles.successTitle}>Message sent</Text>
              <Text style={styles.successBody}>
                Thanks — we&apos;ll be in touch shortly.
              </Text>
            </View>
          </View>
        ) : null}

        <FormField
          label="Your name"
          value={form.name}
          onChangeText={(v) => setField('name', v)}
          placeholder="Full name"
          autoCapitalize="words"
          autoComplete="name"
          error={errors.name}
        />
        <FormField
          label="Email"
          value={form.email}
          onChangeText={(v) => setField('email', v)}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          error={errors.email}
        />
        <FormField
          label="Subject"
          value={form.subject}
          onChangeText={(v) => setField('subject', v)}
          placeholder="What's this about?"
          error={errors.subject}
        />
        <FormField
          label="Message"
          value={form.message}
          onChangeText={(v) => setField('message', v)}
          placeholder="Tell us a bit more — questions, feedback, anything."
          multiline
          numberOfLines={5}
          error={errors.message}
        />

        {submitError ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color={colors.danger} />
            <Text style={styles.errorBoxText}>{submitError}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={({ pressed }) => [
            styles.submitBtn,
            { opacity: pressed || submitting ? 0.85 : 1 },
          ]}
        >
          <LinearGradient
            colors={['#f59e0b', '#d97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitFill}
          >
            {submitting ? (
              <ActivityIndicator color={colors.textInverse} size="small" />
            ) : (
              <Feather name="send" size={14} color={colors.textInverse} />
            )}
            <Text style={styles.submitText}>
              {submitting ? 'Sending…' : 'Send message'}
            </Text>
          </LinearGradient>
        </Pressable>
      </Card>
    </ScreenContainer>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  numberOfLines,
  autoCapitalize,
  keyboardType,
  autoComplete,
  error,
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? numberOfLines || 4 : undefined}
        textAlignVertical={multiline ? 'top' : 'auto'}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          error && styles.inputError,
        ]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    // Push the headline down from the nav header so it doesn't kiss
    // the title-bar boundary. The dashboard screens are flush by
    // design (their cards bring their own surface); a plain text
    // headline needs the explicit gap.
    marginTop: spacing.lg,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  subhead: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  channels: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  rowBody: {
    marginTop: 2,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  // Form
  formCard: { marginTop: spacing.lg },
  formTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  formSubtitle: {
    marginTop: 2,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  field: { marginTop: spacing.md },
  fieldLabel: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  inputMultiline: {
    minHeight: 110,
    paddingTop: 10,
  },
  inputError: { borderColor: colors.danger },
  fieldError: {
    marginTop: 4,
    fontSize: 11,
    color: colors.danger,
  },

  successBox: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#6ee7b7',
  },
  successTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#065f46',
  },
  successBody: {
    marginTop: 2,
    fontSize: 12,
    color: '#047857',
  },
  errorBox: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorBoxText: {
    flex: 1,
    fontSize: 12,
    color: colors.danger,
  },
  submitBtn: {
    marginTop: spacing.md,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  submitFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  submitText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.2,
  },
});
