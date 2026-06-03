// ReviewComposer — modal sheet for posting a star + comment review.
// Renders a 5-star picker, a comment field, and submits to
// reviewService.createReview. Parent receives the new review (if the
// API returns it) via onSubmitted and can prepend it to the list.

import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import StarRow from './StarRow';
import { createReview } from '../../services/reviewService';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const RATING_LABELS = ['Tap to rate', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

export default function ReviewComposer({
  open,
  professionalId,
  onClose,
  onSubmitted,
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setRating(0);
    setComment('');
    setError('');
    setSubmitting(false);
  }

  async function submit() {
    if (!rating) {
      setError('Pick a rating to continue.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await createReview({
        professionalId,
        rating,
        comment: comment.trim() || undefined,
      });
      const created = (res && (res.review || res)) || null;
      onSubmitted && onSubmitted(created);
      reset();
      onClose && onClose();
    } catch (err) {
      setError(err.message || 'Could not post the review.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.sheet} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.title}>Write a review</Text>
          <Pressable
            onPress={() => {
              reset();
              onClose && onClose();
            }}
            hitSlop={8}
          >
            <Feather name="x" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.ratingBlock}>
            <Text style={styles.label}>Your rating</Text>
            <StarRow
              value={rating}
              size={36}
              interactive
              onChange={setRating}
            />
            <Text style={styles.ratingLabel}>
              {RATING_LABELS[rating] || RATING_LABELS[0]}
            </Text>
          </View>

          <Text style={styles.label}>Your review (optional)</Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="What stood out about your consultation?"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={5}
            style={styles.input}
            textAlignVertical="top"
          />

          {error ? (
            <View style={styles.errBanner}>
              <Feather
                name="alert-circle"
                size={13}
                color={colors.dangerSoftText}
              />
              <Text style={styles.errText}>{error}</Text>
            </View>
          ) : null}
        </View>

        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <Pressable
            onPress={submitting ? undefined : submit}
            style={({ pressed }) => [
              styles.cta,
              { opacity: submitting ? 0.7 : pressed ? 0.9 : 1 },
            ]}
          >
            <LinearGradient
              colors={['#f59e0b', '#d97706']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaFill}
            >
              {submitting ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <>
                  <Text style={styles.ctaText}>Post review</Text>
                  <Feather
                    name="send"
                    size={14}
                    color={colors.textInverse}
                  />
                </>
              )}
            </LinearGradient>
          </Pressable>
        </SafeAreaView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  body: { padding: spacing.lg, gap: spacing.md, flex: 1 },
  ratingBlock: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  label: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  ratingLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  input: {
    minHeight: 120,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    lineHeight: 21,
  },
  errBanner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: colors.dangerSoft,
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  errText: { flex: 1, fontSize: fontSize.sm, color: colors.dangerSoftText },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  cta: { borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.md },
  ctaFill: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ctaText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
});
