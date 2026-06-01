// HeroHeader — gradient hero block at the top of dashboards. Holds a
// small eyebrow label, big title, supporting line, and a slot for
// actions/badges on the right (notifications icon, etc.).

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, gradients, radius, spacing } from '../../theme';

export default function HeroHeader({
  eyebrow,
  title,
  subtitle,
  trailingIcon,
  onTrailingPress,
  trailingBadge,
  children,
}) {
  return (
    <LinearGradient
      colors={gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.wrap}
    >
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {trailingIcon ? (
          <Pressable
            onPress={onTrailingPress}
            style={({ pressed }) => [
              styles.trailing,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name={trailingIcon} size={20} color={colors.textInverse} />
            {trailingBadge ? <View style={styles.trailingDot} /> : null}
          </Pressable>
        ) : null}
      </View>
      {children ? <View style={styles.body}>{children}</View> : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  eyebrow: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
  subtitle: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 20,
  },
  trailing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailingDot: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  body: { marginTop: spacing.md },
});
