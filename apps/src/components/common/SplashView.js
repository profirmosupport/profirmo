// SplashView — professional brand splash. Deep ink → navy gradient
// with a single amber accent. Logo fades in, brand wordmark rises,
// then the two taglines stagger in. Held by RootNavigator for 5
// seconds before transitioning to the next screen.
//
// Restrained on purpose — no rotating halos or rainbow stripes; just
// the wordmark + a hairline divider + the value props.

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

const TAGLINES = [
  'Get professionals and firms online.',
  'Legal help, a call away.',
];

export default function SplashView({ message }) {
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordY = useRef(new Animated.Value(12)).current;
  const dividerScale = useRef(new Animated.Value(0)).current;
  const tag1Opacity = useRef(new Animated.Value(0)).current;
  const tag2Opacity = useRef(new Animated.Value(0)).current;
  const dotsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // Wordmark rises + fades in
      Animated.parallel([
        Animated.timing(wordOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(wordY, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // Hairline divider grows from center
      Animated.timing(dividerScale, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // Taglines, staggered
      Animated.timing(tag1Opacity, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(tag2Opacity, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      // Loader dots bottom-fade in
      Animated.timing(dotsOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, [dividerScale, dotsOpacity, tag1Opacity, tag2Opacity, wordOpacity, wordY]);

  return (
    <LinearGradient
      colors={['#0b1220', '#0f172a', '#1e293b']}
      locations={[0, 0.55, 1]}
      style={styles.wrap}
    >
      <View style={styles.center}>
        <Animated.Text
          style={[
            styles.word,
            { opacity: wordOpacity, transform: [{ translateY: wordY }] },
          ]}
        >
          Profirmo
        </Animated.Text>

        <Animated.View
          style={[styles.divider, { transform: [{ scaleX: dividerScale }] }]}
        />

        <Animated.Text style={[styles.tag, { opacity: tag1Opacity }]}>
          {TAGLINES[0]}
        </Animated.Text>
        <Animated.Text
          style={[styles.tag, styles.tag2, { opacity: tag2Opacity }]}
        >
          {TAGLINES[1]}
        </Animated.Text>
      </View>

      <Animated.View style={[styles.loaderRow, { opacity: dotsOpacity }]}>
        <PulseDot delay={0} />
        <PulseDot delay={200} />
        <PulseDot delay={400} />
        {message ? <Text style={styles.loaderText}>{message}</Text> : null}
      </Animated.View>
    </LinearGradient>
  );
}

function PulseDot({ delay }) {
  const v = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.35, duration: 450, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, v]);
  return <Animated.View style={[styles.dot, { opacity: v }]} />;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  word: {
    fontSize: 40,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.8,
  },
  divider: {
    marginTop: spacing.md,
    width: 64,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  tag: {
    marginTop: spacing.lg,
    fontSize: fontSize.base,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  tag2: {
    marginTop: 6,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.62)',
    fontWeight: fontWeight.medium,
  },
  loaderRow: {
    position: 'absolute',
    bottom: spacing['2xl'] * 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  loaderText: {
    marginLeft: spacing.sm,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: fontWeight.semibold,
  },
});
