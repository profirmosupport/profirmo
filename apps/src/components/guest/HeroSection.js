// HeroSection — top block on the guest landing screen. Ink gradient
// background with two CTAs: a primary AI button + a secondary
// sign-up link that exits guest mode and returns to the welcome
// screen via AuthContext.exitGuest().

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function HeroSection({ onPressAi, onPressSignup }) {
  return (
    <LinearGradient
      colors={['#0b1220', '#0f172a', '#1e293b']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.wrap}
    >
      {/* Decorative dots in the corners — soft brand accents. */}
      <View style={[styles.glow, styles.glowA]} />
      <View style={[styles.glow, styles.glowB]} />

      <Text style={styles.eyebrow}>Profirmo · India</Text>
      <Text style={styles.headline}>
        Legal & tax help, <Text style={styles.headlineAccent}>on demand.</Text>
      </Text>
      <Text style={styles.subhead}>
        Talk to our AI assistant, or pick a verified professional or firm —
        in under a minute.
      </Text>

      <View style={styles.ctaCol}>
        <Pressable
          onPress={onPressAi}
          style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.92 : 1 }]}
        >
          <LinearGradient
            colors={['#f59e0b', '#d97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaFill}
          >
            <Feather name="message-circle" size={16} color={colors.textInverse} />
            <Text style={styles.ctaLabel}>Discuss with AI</Text>
            <Feather name="arrow-right" size={14} color={colors.textInverse} />
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={onPressSignup}
          style={({ pressed }) => [
            styles.secondary,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="user-plus" size={14} color={colors.textInverse} />
          <Text style={styles.secondaryLabel}>Sign up — it's free</Text>
        </Pressable>
      </View>

      <View style={styles.trustRow}>
        <TrustPill icon="award" label="Verified pros" />
        <TrustPill icon="shield" label="Escrowed pay" />
        <TrustPill icon="message-circle" label="24h reply" />
      </View>
    </LinearGradient>
  );
}

function TrustPill({ icon, label }) {
  return (
    <View style={styles.pill}>
      <Feather name={icon} size={10} color={colors.primary} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.lg,
    paddingHorizontal: spacing.lg,
    // Comfortable top padding below the dark safe-area strip — about
    // 5 % of a 6.1" phone, giving the eyebrow + headline room to
    // breathe before the CTAs.
    paddingTop: spacing.xl + spacing.md,
    paddingBottom: spacing.xl + spacing.sm,
    overflow: 'hidden',
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  glow: { position: 'absolute', borderRadius: 999 },
  glowA: {
    top: -40,
    right: -50,
    width: 180,
    height: 180,
    backgroundColor: 'rgba(217,119,6,0.18)',
  },
  glowB: {
    bottom: -40,
    left: -40,
    width: 140,
    height: 140,
    backgroundColor: 'rgba(13,148,136,0.18)',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
  },
  headline: {
    marginTop: 8,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: -0.2,
  },
  headlineAccent: { color: colors.primary },
  subhead: {
    marginTop: 8,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 20,
  },
  ctaCol: { marginTop: spacing.lg, gap: spacing.sm },
  cta: { borderRadius: radius.lg, shadowColor: '#d97706', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  ctaFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
  },
  ctaLabel: {
    color: colors.textInverse,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.base,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  secondaryLabel: {
    color: colors.textInverse,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.sm,
  },
  trustRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  pillText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: 'rgba(255,255,255,0.92)',
  },
});
