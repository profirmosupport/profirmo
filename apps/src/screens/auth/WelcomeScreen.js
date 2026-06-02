// WelcomeScreen — first screen new visitors see after the splash.
//
// Layout (top → bottom):
//   1. Ink-filled background fills the screen (no stretching of the
//      hero image).
//   2. Hero photo sits in the top portion with `resizeMode="cover"`
//      preserving aspect — height is clamped so the photo isn't
//      pulled out of proportion on tall phones.
//   3. A transparent → solid-ink gradient hugs the image's bottom
//      edge, blending the photo into the content panel below.
//   4. The content panel (eyebrow + headline + subhead + CTAs) lives
//      in the bottom block on solid ink so copy stays crisp.
//
// Top-right "Skip" pill calls enterGuest() → RootNavigator swaps to
// ClientTabs so the visitor can browse the app without an account.

import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientButton from '../../components/auth/GradientButton';
import SkipButton from '../../components/auth/SkipButton';
import { useAuth } from '../../contexts/AuthContext';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

const HERO = require('../../assets/signup-hero.jpg');

export default function WelcomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { enterGuest } = useAuth();

  return (
    <View style={styles.root}>
      <View style={[styles.topStrip, { height: insets.top }]} />

      {/* Hero photo — fixed-height frame, cover-fit, no stretch. */}
      <View style={styles.heroFrame}>
        <Image source={HERO} style={styles.heroImage} resizeMode="cover" />
        {/* Smooth fade from photo into ink panel below. */}
        <LinearGradient
          colors={['rgba(11,18,32,0)', 'rgba(11,18,32,0.65)', '#0b1220']}
          locations={[0, 0.65, 1]}
          style={styles.heroFade}
          pointerEvents="none"
        />
      </View>

      {/* Skip pill — absolute, on top of the photo. */}
      <View
        style={[styles.topRight, { top: insets.top + spacing.sm }]}
        pointerEvents="box-none"
      >
        <SkipButton onPress={enterGuest} tone="dark" />
      </View>

      {/* Content panel — solid ink with a subtle gradient at the top
          edge so the join with the hero fade reads cleanly. */}
      <SafeAreaView style={styles.bottom} edges={['bottom', 'left', 'right']}>
        <LinearGradient
          colors={['rgba(11,18,32,0.85)', '#0b1220']}
          locations={[0, 0.4]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.bottomInner}>
          <Text style={styles.eyebrow}>Welcome to Profirmo</Text>
          <Text style={styles.headline}>
            Get professionals and firms{' '}
            <Text style={styles.headlineAccent}>online.</Text>
          </Text>
          <Text style={styles.subhead}>
            Legal help, a call away. Verified lawyers and tax experts ready
            when you are.
          </Text>

          <View style={styles.featureRow}>
            <FeaturePill icon="award" label="Verified pros" />
            <FeaturePill icon="shield" label="Escrowed pay" />
            <FeaturePill icon="message-circle" label="24h reply" />
          </View>

          <GradientButton
            title="Create your account"
            trailingIcon="arrow-right"
            onPress={() => navigation.navigate('Signup')}
            style={{ marginTop: spacing.lg }}
          />
          <Pressable
            onPress={() => navigation.navigate('Login')}
            style={({ pressed }) => [
              styles.signInBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.signInText}>
              Already have an account?{' '}
              <Text style={styles.signInLink}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function FeaturePill({ icon, label }) {
  return (
    <View style={styles.pill}>
      <Feather name={icon} size={11} color={colors.primary} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1220' },
  topStrip: { backgroundColor: colors.ink, width: '100%' },

  // Hero photo lives in roughly the top half of the screen. flex: 1.05
  // makes it slightly taller than the content panel (which has flex: 1)
  // so the focal subject reads well above the gradient blend.
  heroFrame: {
    flex: 1.05,
    backgroundColor: '#0b1220',
    overflow: 'hidden',
  },
  heroImage: { width: '100%', height: '100%' },
  heroFade: { ...StyleSheet.absoluteFillObject },

  topRight: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 5,
  },

  bottom: { flex: 1, backgroundColor: '#0b1220' },
  bottomInner: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    justifyContent: 'flex-end',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.65)',
  },
  headline: {
    marginTop: spacing.sm,
    fontSize: 30,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: -0.3,
    lineHeight: 36,
  },
  headlineAccent: { color: colors.primary },
  subhead: {
    marginTop: 8,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.78)',
  },
  featureRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
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

  signInBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  signInText: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.78)',
  },
  signInLink: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
});
