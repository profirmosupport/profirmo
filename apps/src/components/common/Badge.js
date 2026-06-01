import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

// Badge — small rounded pill, matches the web Badge variants.

const VARIANTS = {
  gray: { bg: colors.surfaceMuted, text: colors.textSecondary },
  blue: { bg: colors.infoSoft, text: colors.infoSoftText },
  green: { bg: colors.successSoft, text: colors.successSoftText },
  amber: { bg: colors.primarySoft, text: colors.primarySoftText },
  red: { bg: colors.dangerSoft, text: colors.dangerSoftText },
  violet: { bg: '#ede9fe', text: '#5b21b6' },
};

export default function Badge({ children, variant = 'gray', style }) {
  const v = VARIANTS[variant] || VARIANTS.gray;
  return (
    <View style={[styles.pill, { backgroundColor: v.bg }, style]}>
      <Text style={[styles.text, { color: v.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'capitalize',
  },
});
