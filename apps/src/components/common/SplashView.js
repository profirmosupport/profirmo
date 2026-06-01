// SplashView — branded full-screen loader. Used during cold-start auth
// hydration AND as the in-app fallback while a screen waits for its
// first data fetch.
//
// On mount we run an entrance animation (fade + scale on the logo, then
// title rise, then tagline fade-in, with a continuously pulsing dot
// indicator). The whole intro lasts ~1.8s; RootNavigator additionally
// enforces a 3-second minimum hold so the brand moment is always seen.

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, gradients, spacing } from '../../theme';

export default function SplashView({ message = 'Loading…', subtitle }) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const titleY = useRef(new Animated.Value(20)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const haloScale = useRef(new Animated.Value(1)).current;
  const haloOpacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    // Entrance: logo pops in, then title rises, then tagline fades.
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(120),
      Animated.parallel([
        Animated.timing(titleY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous halo + dot pulse — keeps the splash feeling alive
    // through the full 3-second hold.
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(haloScale, {
            toValue: 1.25,
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(haloScale, {
            toValue: 1,
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(haloOpacity, {
            toValue: 0.05,
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(haloOpacity, {
            toValue: 0.35,
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, [haloOpacity, haloScale, logoOpacity, logoScale, pulse, taglineOpacity, titleOpacity, titleY]);

  const dotScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });

  return (
    <LinearGradient
      colors={gradients.splash}
      locations={[0, 0.55, 1]}
      style={styles.wrap}
    >
      <View style={styles.brand}>
        {/* Halo behind the logo — slow scale + opacity loop. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            { transform: [{ scale: haloScale }], opacity: haloOpacity },
          ]}
        />
        <Animated.View
          style={[
            styles.logoBubble,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
        >
          <Feather name="briefcase" size={44} color={colors.primary} />
        </Animated.View>
        <Animated.Text
          style={[
            styles.logo,
            { opacity: titleOpacity, transform: [{ translateY: titleY }] },
          ]}
        >
          Profirmo
        </Animated.Text>
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          Legal & tax expertise, on call.
        </Animated.Text>
      </View>
      <View style={styles.loaderBlock}>
        <View style={styles.dotRow}>
          <Pulse value={pulse} delay={0} />
          <Pulse value={pulse} delay={150} />
          <Pulse value={pulse} delay={300} />
        </View>
        <Text style={styles.loaderText}>{message}</Text>
        {subtitle ? <Text style={styles.loaderSubtitle}>{subtitle}</Text> : null}
      </View>
    </LinearGradient>
  );
}

// Pulse — three of these bounce in sequence below the loader text.
// We can't truly stagger an Animated.Value, so each dot interpolates
// the shared driver against a phase-shifted input range. The visible
// effect is the same: a wave of pulsing dots.
function Pulse({ value, delay }) {
  const phaseShift = delay / 1800; // ~ portion of the 1.8s full loop
  const scale = value.interpolate({
    inputRange: [Math.max(0, 0 - phaseShift), Math.max(0, 0.5 - phaseShift), 1 - phaseShift],
    outputRange: [0.6, 1, 0.6],
    extrapolate: 'clamp',
  });
  const opacity = value.interpolate({
    inputRange: [Math.max(0, 0 - phaseShift), Math.max(0, 0.5 - phaseShift), 1 - phaseShift],
    outputRange: [0.35, 1, 0.35],
    extrapolate: 'clamp',
  });
  return (
    <Animated.View
      style={[
        styles.dot,
        { transform: [{ scale }], opacity },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  brand: { alignItems: 'center' },
  halo: {
    position: 'absolute',
    top: -4,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.primary,
  },
  logoBubble: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logo: {
    fontSize: 34,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.6,
  },
  tagline: {
    marginTop: 6,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.72)',
  },
  loaderBlock: {
    position: 'absolute',
    bottom: spacing['2xl'] * 2,
    alignItems: 'center',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  loaderText: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: fontWeight.semibold,
  },
  loaderSubtitle: {
    marginTop: 4,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.55)',
  },
});
