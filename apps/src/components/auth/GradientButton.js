// GradientButton — amber→deep-amber CTA that the web uses for the
// primary action on every auth page. Loading state swaps the label for
// an activity indicator.

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function GradientButton({
  title,
  onPress,
  loading,
  disabled,
  trailingIcon = 'arrow-right',
  style,
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.wrap,
        { opacity: isDisabled ? 0.7 : pressed ? 0.92 : 1 },
        style,
      ]}
    >
      <LinearGradient
        colors={['#f59e0b', '#d97706']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color={colors.textInverse} />
        ) : (
          <View style={styles.row}>
            <Text style={styles.label}>{title}</Text>
            {trailingIcon ? (
              <Feather name={trailingIcon} size={16} color={colors.textInverse} />
            ) : null}
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    shadowColor: '#d97706',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
  },
  gradient: {
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    minHeight: 48,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: {
    color: colors.textInverse,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.2,
  },
});
