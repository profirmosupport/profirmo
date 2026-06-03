// DashboardHero — top block on the client / professional dashboards.
// Visually mirrors the guest landing's HeroSection: ink gradient with
// amber + teal glow blobs and a dotted texture, so signed-in users see
// the same brand moment instead of a flat header bar.
//
// Compared to the generic HeroHeader it adds:
//   • A decorative background (no white block above)
//   • Top padding for the floating hamburger + bell that the
//     parent (DashboardScreen) renders absolutely-positioned.
//
// Children render below the headline copy — that's where each
// dashboard slots its quick stats / CTA cards.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function DashboardHero({
  eyebrow,
  title,
  subtitle,
  // Optional pill (e.g. current subscription) rendered top-right.
  trailingPill,
  trailingPillTone = 'amber',
  // Optional CTA row rendered below the headline.
  ctaLabel,
  ctaIcon = 'arrow-right',
  onPressCta,
  children,
}) {
  // The hero paints under the status bar (its parent ScreenContainer
  // uses `bleedTop`). Pad the top by:
  //   • insets.top                          — status-bar height
  //   • 12 + 38 + 12 = 62                   — floating icon row
  //   • spacing.lg                          — gap to the eyebrow text
  // so the hamburger + bell never collide with the headline below.
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={['#0b1220', '#0f172a', '#1e293b']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.wrap,
        { paddingTop: insets.top + 62 + spacing.lg },
      ]}
    >
      {/* Decorative blobs + dotted texture — same recipe as the
          landing hero so the surfaces feel related. */}
      <View style={[styles.glow, styles.glowA]} />
      <View style={[styles.glow, styles.glowB]} />
      <View style={styles.dots} pointerEvents="none">
        {[...Array(40).keys()].map((i) => (
          <View key={i} style={styles.dot} />
        ))}
      </View>

      <View style={styles.copyRow}>
        <View style={{ flex: 1 }}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {trailingPill ? (
          <View
            style={[
              styles.pill,
              trailingPillTone === 'amber'
                ? styles.pillAmber
                : styles.pillGhost,
            ]}
          >
            <Feather
              name={trailingPillTone === 'amber' ? 'award' : 'check'}
              size={11}
              color={
                trailingPillTone === 'amber'
                  ? colors.primary
                  : 'rgba(255,255,255,0.9)'
              }
            />
            <Text
              style={[
                styles.pillText,
                trailingPillTone === 'amber'
                  ? { color: colors.primary }
                  : { color: 'rgba(255,255,255,0.92)' },
              ]}
              numberOfLines={1}
            >
              {trailingPill}
            </Text>
          </View>
        ) : null}
      </View>

      {ctaLabel ? (
        <Pressable
          onPress={onPressCta}
          style={({ pressed }) => [
            styles.cta,
            { opacity: pressed ? 0.92 : 1 },
          ]}
        >
          <LinearGradient
            colors={['#f59e0b', '#d97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaFill}
          >
            <Text style={styles.ctaText}>{ctaLabel}</Text>
            <Feather name={ctaIcon} size={13} color={colors.textInverse} />
          </LinearGradient>
        </Pressable>
      ) : null}

      {children ? <View style={styles.body}>{children}</View> : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // Hero stretches to the screen edges and tucks under the
    // floating top icons in DashboardScreen.
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    // `paddingTop` is set inline to (insets.top + room for icons).
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
  },
  glow: { position: 'absolute', borderRadius: 999 },
  glowA: {
    top: -40,
    right: -50,
    width: 200,
    height: 200,
    backgroundColor: 'rgba(217,119,6,0.22)',
  },
  glowB: {
    bottom: -40,
    left: -40,
    width: 160,
    height: 160,
    backgroundColor: 'rgba(13,148,136,0.22)',
  },
  dots: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 14,
    opacity: 0.14,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#ffffff',
    margin: 10,
  },

  copyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  eyebrow: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 6,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    maxWidth: 160,
  },
  pillAmber: {
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderColor: 'rgba(245,158,11,0.4)',
  },
  pillGhost: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  pillText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  cta: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#d97706',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    alignSelf: 'flex-start',
  },
  ctaFill: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ctaText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },

  body: { marginTop: spacing.md },
});
