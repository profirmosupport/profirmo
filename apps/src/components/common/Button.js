import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

// Button — primary / outline / ghost / danger variants. Loading state
// disables touches and swaps the label for a spinner.

const VARIANTS = {
  primary: {
    bg: colors.primary,
    bgPressed: colors.primaryDark,
    border: colors.primary,
    text: colors.textInverse,
  },
  outline: {
    bg: colors.surface,
    bgPressed: colors.surfaceMuted,
    border: colors.borderStrong,
    text: colors.textPrimary,
  },
  ghost: {
    bg: 'transparent',
    bgPressed: colors.surfaceMuted,
    border: 'transparent',
    text: colors.primary,
  },
  danger: {
    bg: colors.danger,
    bgPressed: '#b91c1c',
    border: colors.danger,
    text: colors.textInverse,
  },
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: pressed && !isDisabled ? v.bgPressed : v.bg,
          borderColor: v.border,
          opacity: isDisabled ? 0.55 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <View style={styles.row}>
          {icon ? <View style={{ marginRight: spacing.xs }}>{icon}</View> : null}
          <Text style={[styles.label, { color: v.text }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
});
