// StatTile — small metric card used on dashboards. Each tile has a
// colored icon bubble that pulls from the theme gradient palette so the
// dashboard reads at a glance.

import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, gradients, radius, spacing } from '../../theme';

const TONES = {
  amber: { bubble: colors.primarySoft, icon: colors.primary },
  emerald: { bubble: colors.successSoft, icon: colors.success },
  rose: { bubble: colors.dangerSoft, icon: colors.danger },
  sky: { bubble: colors.infoSoft, icon: colors.info },
  violet: { bubble: '#ede9fe', icon: '#7c3aed' },
};

export default function StatTile({
  icon = 'activity',
  label,
  value,
  limit,
  hint,
  tone = 'amber',
}) {
  const accent = TONES[tone] || TONES.amber;
  return (
    <View style={styles.tile}>
      <View style={[styles.iconBubble, { backgroundColor: accent.bubble }]}>
        <Feather name={icon} size={16} color={accent.icon} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>
        {value}
        {limit != null ? <Text style={styles.limit}> / {limit}</Text> : null}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  iconBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  value: {
    marginTop: 2,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  limit: { color: colors.textMuted, fontWeight: fontWeight.medium, fontSize: fontSize.sm },
  hint: { marginTop: 4, fontSize: fontSize.xs, color: colors.textSecondary },
});
