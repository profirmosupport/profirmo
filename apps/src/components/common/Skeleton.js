// Skeleton — animated shimmer placeholder used while data loads.
// Two motions running together:
//   1. Subtle base opacity pulse for screens that don't get a real
//      gradient sweep (also covers reduce-motion / underpowered
//      devices that may not run the native shimmer smoothly).
//   2. A translating gradient strip across the surface — the real
//      "shimmer" effect, animated via the native driver.

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../../theme';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export default function Skeleton({
  width = '100%',
  height = 16,
  style,
  rounded = false,
}) {
  const opacity = useRef(new Animated.Value(0.55)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.55,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    const shimmer = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    pulse.start();
    shimmer.start();
    return () => {
      pulse.stop();
      shimmer.stop();
    };
  }, [opacity, sweep]);

  const radiusVal = rounded ? (typeof height === 'number' ? height / 2 : 999) : radius.sm;
  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-160, 320],
  });

  return (
    <Animated.View
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius: radiusVal,
          opacity,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <AnimatedLinearGradient
        colors={[
          'rgba(255,255,255,0)',
          'rgba(255,255,255,0.85)',
          'rgba(255,255,255,0)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.shimmer,
          { transform: [{ translateX }] },
        ]}
      />
    </Animated.View>
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="60%" height={14} />
      <Skeleton width="35%" height={11} style={{ marginTop: 8 }} />
      <Skeleton width="80%" height={11} style={{ marginTop: 6 }} />
    </View>
  );
}

// ProfessionalCardSkeleton — mimics the layout of
// ProfessionalHorizontalCard so the carousel doesn't visibly reshape
// when real data arrives.
export function ProfessionalCardSkeleton({ width = 268 }) {
  return (
    <View style={[styles.proCard, { width }]}>
      <View style={styles.proHead}>
        <Skeleton width={52} height={52} rounded />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="80%" height={14} />
          <Skeleton width="60%" height={11} />
        </View>
      </View>
      <View style={styles.metaRow}>
        <Skeleton width={56} height={16} rounded />
        <Skeleton width={42} height={16} rounded />
      </View>
      <Skeleton width="40%" height={16} style={{ marginTop: 12 }} />
      <View style={styles.proCta}>
        <Skeleton width="48%" height={32} style={{ borderRadius: radius.md }} />
        <Skeleton width="48%" height={32} style={{ borderRadius: radius.md }} />
      </View>
    </View>
  );
}

// FirmCardSkeleton — banner block + body block to mirror FirmCard.
export function FirmCardSkeleton({ width = 268 }) {
  return (
    <View style={[styles.firmCard, { width }]}>
      <Skeleton width="100%" height={90} style={{ borderRadius: 0 }} />
      <View style={{ padding: 12, gap: 8 }}>
        <Skeleton width="65%" height={14} />
        <Skeleton width="40%" height={11} />
        <Skeleton width="100%" height={36} style={{ marginTop: 8, borderRadius: radius.md }} />
      </View>
    </View>
  );
}

// BlogCardSkeleton — 16:9 cover + 3 text lines to mirror BlogCard.
export function BlogCardSkeleton() {
  return (
    <View style={styles.blogCard}>
      <Skeleton width="100%" height={170} style={{ borderRadius: 0 }} />
      <View style={{ padding: 12, gap: 6 }}>
        <Skeleton width="90%" height={14} />
        <Skeleton width="100%" height={11} />
        <Skeleton width="60%" height={11} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surfaceMuted },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  proCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  proHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  metaRow: { flexDirection: 'row', gap: 6 },
  proCta: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  firmCard: {
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  blogCard: {
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});
