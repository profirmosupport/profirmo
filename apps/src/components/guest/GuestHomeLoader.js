// GuestHomeLoader — full-screen loading state shown while the guest
// home page is fetching its first payload. Mirrors the structure of
// the real page so the transition to live content is gentle: ink
// hero block at the top with an animated brand wordmark + tagline,
// then shimmering carousel and expertise placeholders below.

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BlogCardSkeleton,
  CardSkeleton,
  FirmCardSkeleton,
  ProfessionalCardSkeleton,
} from '../common/Skeleton';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function GuestHomeLoader() {
  // Slow wordmark fade-in + ping — same vibe as the splash but only
  // shows on the home page itself.
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
        <Animated.Text style={[styles.word, { opacity: wordOpacity }]}>
          Profirmo
        </Animated.Text>
        <Animated.View
          style={[styles.divider, { transform: [{ scaleX: lineScale }] }]}
        />
        <Text style={styles.tag}>
          Loading legal & tax help…
        </Text>
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
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
        <View style={styles.searchSkel}>
          <CardSkeleton />
        </View>

        <SectionPlaceholder
          title="Experts a call away"
          Component={ProfessionalCardSkeleton}
        />
        <SectionPlaceholder
          title="Firms on Profirmo"
          Component={FirmCardSkeleton}
        />

        <View style={styles.expertise}>
          <Text style={styles.sectionTitle}>Area of expertise</Text>
          <View style={styles.tileGrid}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.tileSkel}>
                <CardSkeleton />
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Blog & News</Text>
        <View style={{ gap: spacing.md }}>
          <BlogCardSkeleton />
          <BlogCardSkeleton />
        </View>
      </View>
    </View>
  );
}

function SectionPlaceholder({ title, Component }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.row}>
        <Component />
        <Component />
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
  tag: {
    marginTop: spacing.md,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: fontWeight.semibold,
  },
  dotsRow: { marginTop: spacing.lg, flexDirection: 'row' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },

  body: { padding: spacing.lg, gap: spacing.xl },
  searchSkel: {},
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  row: { flexDirection: 'row', gap: 12 },

  expertise: { gap: spacing.sm },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tileSkel: { flexBasis: '48%', flexGrow: 1, height: 108 },
});
