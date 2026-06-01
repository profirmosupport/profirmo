// StepProgress — wizard chrome that shows the current step number,
// label and a progress bar. Mirrors the web's "Step 1 of 3 · Personal
// info" header with the gradient progress bar.

import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function StepProgress({
  step,
  total,
  labels,
  badge,
  badgeIcon,
}) {
  const pct = Math.min(100, Math.max(0, (step / total) * 100));
  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        {badge ? (
          <View style={styles.badge}>
            {badgeIcon ? (
              <Feather name={badgeIcon} size={12} color={colors.primary} />
            ) : null}
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : (
          <View />
        )}
        <Text style={styles.counter}>
          Step {step} of {total} · {labels[step - 1]}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <LinearGradient
          colors={['#f59e0b', '#0d9488']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.barFill, { width: `${pct}%` }]}
        />
      </View>
      <View style={styles.dotsRow}>
        {labels.map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <View key={label} style={styles.dotCol}>
              <View
                style={[
                  styles.dot,
                  active && styles.dotActive,
                  done && styles.dotDone,
                ]}
              >
                {done ? (
                  <Feather name="check" size={11} color={colors.textInverse} />
                ) : (
                  <Text
                    style={[
                      styles.dotNum,
                      active && styles.dotNumActive,
                    ]}
                  >
                    {n}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.dotLabel,
                  active && styles.dotLabelActive,
                  done && styles.dotLabelDone,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  badgeText: { fontSize: 11, fontWeight: fontWeight.bold, color: colors.primarySoftText },
  counter: { fontSize: 11, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  barTrack: { height: 6, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  dotsRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  dotCol: { alignItems: 'center', flex: 1, gap: 4 },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  dotActive: { backgroundColor: colors.primary },
  dotDone: { backgroundColor: colors.success },
  dotNum: { fontSize: 10, fontWeight: fontWeight.bold, color: colors.textMuted },
  dotNumActive: { color: colors.textInverse },
  dotLabel: { fontSize: 10, color: colors.textMuted, fontWeight: fontWeight.semibold },
  dotLabelActive: { color: colors.primarySoftText },
  dotLabelDone: { color: colors.success },
});
