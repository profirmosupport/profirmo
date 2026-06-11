// DashboardLoader — first-paint loading state for the client + pro
// dashboards. Same vibe as GuestHomeLoader (the landing page) so
// signed-in users see the same brand moment on cold start:
//   1. Dark ink hero with animated "Profirmo" wordmark + tagline + dots.
//   2. Skeleton blocks shaped like the real dashboard sections so the
//      transition to live content is gentle.

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CardSkeleton } from './Skeleton';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function DashboardLoader({
  // Optional greeting under the wordmark, e.g. "Welcome back, Vishal".
  greeting,
  // Optional tagline below the divider; defaults to a friendly
  // "Loading your dashboard…".
  tagline = 'Loading your dashboard…',
  // Number of quick-action tiles to skeleton (3 for client, 4 for pro).
  tileCount = 4,
}) {
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const lineScale = useRef(new Animated.Value(0)).current;
  const dotPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(wordOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(lineScale, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(dotPulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [dotPulse, lineScale, wordOpacity]);

  const dotOpacity = dotPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0b1220', '#0f172a', '#1e293b']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        {/* Decorative glow blobs + dotted pattern — matches the
            live DashboardHero so the transition feels seamless. */}
        <View style={[styles.glow, styles.glowA]} />
        <View style={[styles.glow, styles.glowB]} />
        <View style={styles.dots} pointerEvents="none">
          {[...Array(36).keys()].map((i) => (
            <View key={i} style={styles.dot} />
          ))}
        </View>

        <Animated.Text style={[styles.word, { opacity: wordOpacity }]}>
          Profirmo
        </Animated.Text>
        <Animated.View
          style={[styles.divider, { transform: [{ scaleX: lineScale }] }]}
        />
        {greeting ? (
          <Text style={styles.greeting} numberOfLines={1}>
            {greeting}
          </Text>
        ) : null}
        <Text style={styles.tag}>{tagline}</Text>
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.pulseDot,
                {
                  opacity: dotOpacity,
                  transform: [
                    {
                      scale: dotPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.85, 1.15],
                      }),
                    },
                  ],
                  marginLeft: i === 0 ? 0 : 6,
                },
              ]}
            />
          ))}
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {/* Subscription / CTA card placeholder */}
        <CardSkeleton />

        {/* Quick-action tile row — round icon + label/value below. */}
        <View style={styles.tileRow}>
          {Array.from({ length: tileCount }).map((_, i) => (
            <View key={i} style={styles.tileCol}>
              <View style={styles.tileIcon} />
              <View style={styles.tileLabel} />
              <View style={styles.tileValue} />
            </View>
          ))}
        </View>

        {/* Section header skeleton */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitle} />
          <View style={styles.sectionLink} />
        </View>

        {/* Booking-row skeletons */}
        <View style={{ gap: spacing.sm }}>
          {[0, 1].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['2xl'] + spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    alignItems: 'center',
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

  word: {
    fontSize: 32,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.6,
  },
  divider: {
    marginTop: spacing.sm,
    width: 56,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  greeting: {
    marginTop: spacing.md,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: 'rgba(255,255,255,0.88)',
  },
  tag: {
    marginTop: 6,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.72)',
    fontWeight: fontWeight.semibold,
  },
  dotsRow: { marginTop: spacing.lg, flexDirection: 'row' },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  body: { padding: spacing.lg, gap: spacing.md },

  // Quick-tile row skeleton — matches the icon-tile bar on the live
  // dashboards. Pure shimmer-free placeholder shapes; if a fancier
  // shimmer is needed later this is the single place to swap.
  tileRow: { flexDirection: 'row', gap: spacing.sm },
  tileCol: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    marginBottom: 6,
  },
  tileLabel: {
    width: 50,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.surfaceMuted,
    marginBottom: 4,
  },
  tileValue: {
    width: 36,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.surfaceMuted,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: {
    width: 160,
    height: 16,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
  },
  sectionLink: {
    width: 48,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceMuted,
  },
});
