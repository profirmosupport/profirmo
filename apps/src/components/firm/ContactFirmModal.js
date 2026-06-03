// ContactFirmModal — mobile mirror of the web's ContactFirmModal.
// Collects fullName / email / phone / optional message from a visitor
// on the firm profile screen and submits a Lead row tied to the firm
// (source = "Firm contact"). The firm sees the inquiry on their
// dashboard, admin sees it under /admin/leads with firm name attached.

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { submitLead } from '../../services/leadService';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const EMPTY = { fullName: '', email: '', phone: '', message: '' };

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());

export default function ContactFirmModal({ visible, onClose, firm }) {
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');

  // Prefill from the signed-in user every time the modal opens — the
  // visitor can still edit any field before sending. Resets cleanly
  // on close so reopening for a different firm starts fresh.
  useEffect(() => {
    if (!visible) return;
    setErrors({});
    setSubmitting(false);
    setSubmitted(false);
    setServerError('');
    if (user) {
      const fullName =
        user.fullName ||
        [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
        '';
      setForm({
        fullName,
        email: user.email || '',
        phone: user.mobileNumber || user.phone || '',
        message: '',
      });
    } else {
      setForm(EMPTY);
    }
  }, [visible, user]);

  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  }

  function validate() {
    const next = {};
    if (!form.fullName.trim()) next.fullName = 'Name is required.';
    if (!form.email.trim()) next.email = 'Email is required.';
    else if (!isEmail(form.email)) next.email = 'Enter a valid email.';
    const phoneDigits = String(form.phone).replace(/\D/g, '');
    if (!form.phone.trim()) next.phone = 'Phone is required.';
    else if (phoneDigits.length < 7) next.phone = 'Enter a valid phone.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (submitting) return;
    setServerError('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      await submitLead({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        message: form.message.trim() || undefined,
        source: 'Firm contact',
        firmId: firm && firm.id,
      });
      setSubmitted(true);
    } catch (err) {
      setServerError(err.message || 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    onClose?.();
  }

  const firmName = (firm && (firm.firmName || firm.name)) || 'firm';
  const title = submitted ? 'Inquiry sent' : `Contact ${firmName}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdropTap} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              {!submitted ? (
                <Text style={styles.subtitle}>
                  Share a few details and the firm will reach out. We never
                  share your contact information publicly.
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={handleClose}
              hitSlop={10}
              style={styles.closeBtn}
            >
              <Feather name="x" size={18} color={colors.textPrimary} />
            </Pressable>
          </View>

          {submitted ? (
            <View style={styles.successWrap}>
              <View style={styles.successIcon}>
                <Feather name="check" size={24} color={colors.textInverse} />
              </View>
              <Text style={styles.successText}>
                Thanks — the firm has received your inquiry and will be in
                touch with you shortly.
              </Text>
              <Pressable
                onPress={handleClose}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <LinearGradient
                  colors={['#f59e0b', '#d97706']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryFill}
                >
                  <Text style={styles.primaryText}>Done</Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: spacing.lg }}
            >
              <Field
                label="Your name"
                value={form.fullName}
                onChangeText={(v) => setField('fullName', v)}
                placeholder="e.g. Vishal Singh"
                autoCapitalize="words"
                error={errors.fullName}
              />
              <Field
                label="Email"
                value={form.email}
                onChangeText={(v) => setField('email', v)}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                error={errors.email}
              />
              <Field
                label="Phone"
                value={form.phone}
                onChangeText={(v) => setField('phone', v)}
                placeholder="+91 …"
                keyboardType="phone-pad"
                error={errors.phone}
              />
              <Field
                label="Message"
                hint="optional"
                value={form.message}
                onChangeText={(v) => setField('message', v)}
                placeholder="Briefly describe how the firm can help…"
                multiline
              />

              {serverError ? (
                <View style={styles.errorBox}>
                  <Feather
                    name="alert-circle"
                    size={14}
                    color={colors.danger}
                  />
                  <Text style={styles.errorText}>{serverError}</Text>
                </View>
              ) : null}

              <View style={styles.actionRow}>
                <Pressable
                  onPress={handleClose}
                  style={({ pressed }) => [
                    styles.outlineBtn,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={styles.outlineText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSubmit}
                  disabled={submitting}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { flex: 1.4, opacity: pressed ? 0.92 : 1 },
                  ]}
                >
                  <LinearGradient
                    colors={['#f59e0b', '#d97706']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryFill}
                  >
                    {submitting ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.textInverse}
                      />
                    ) : (
                      <Feather
                        name="send"
                        size={14}
                        color={colors.textInverse}
                      />
                    )}
                    <Text style={styles.primaryText}>
                      {submitting ? 'Sending…' : 'Send inquiry'}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, hint, error, multiline, ...rest }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>
        {label}
        {hint ? <Text style={styles.fieldHint}> ({hint})</Text> : null}
      </Text>
      <TextInput
        {...rest}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholderTextColor={colors.textMuted}
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  backdropTap: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '92%',
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },

  fieldWrap: { marginTop: spacing.sm },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  fieldHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  inputMultiline: {
    minHeight: 96,
    paddingTop: 12,
  },
  inputError: { borderColor: colors.danger },
  fieldError: {
    marginTop: 4,
    fontSize: 11,
    color: colors.danger,
    fontWeight: fontWeight.semibold,
  },

  errorBox: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(220,38,38,0.08)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.danger,
    fontWeight: fontWeight.semibold,
    lineHeight: 17,
  },

  actionRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: 8,
  },
  outlineBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  primaryBtn: { borderRadius: radius.md, overflow: 'hidden' },
  primaryFill: {
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },

  successWrap: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: spacing.md,
  },
});
