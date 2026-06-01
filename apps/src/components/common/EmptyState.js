import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

// EmptyState — illustrated "nothing here yet" placeholder. Pass any
// Feather icon name (default "inbox") for a circular accent that
// matches the brand without needing per-screen illustrations.

const TONES = {
  amber: { bg: colors.primarySoft, fg: colors.primary },
  slate: { bg: colors.surfaceMuted, fg: colors.textSecondary },
  emerald: { bg: colors.successSoft, fg: colors.success },
};

export default function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  tone = 'amber',
}) {
  const accent = TONES[tone] || TONES.amber;
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconRing, { backgroundColor: accent.bg }]}>
        <Feather name={icon} size={28} color={accent.fg} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.lg,
  },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    marginTop: 6,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  action: { marginTop: spacing.lg },
});
