// AuthShell — shared frame for Login + Signup.
// Layout:
//   - Top safe-area strip in brand ink
//   - Amber → white → teal gradient body
//   - Title + glass card sit toward the TOP (small top padding) so
//     the user lands on the form without scrolling
//   - Optional illustration slot at the bottom of the scroll for
//     brand atmosphere on shorter screens (typically Login)

import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function AuthShell({
  title,
  subtitle,
  footer,
  illustration,
  children,
}) {
  const insets = useSafeAreaInsets();
  // Drop the headline block entirely when no title is provided — the
  // pro-form wizard skips it so the step-progress widget anchors to
  // the top of the card.
  const hasHeadline = Boolean(title);
  return (
    <View style={styles.root}>
      <View style={[styles.topStrip, { height: insets.top }]} />
      <LinearGradient
        colors={['#fffbeb', '#ffffff', '#f0fdfa']}
        style={styles.bg}
      >
        <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              contentContainerStyle={[
                styles.scroll,
                !hasHeadline && styles.scrollTight,
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {hasHeadline ? (
                <View style={styles.headline}>
                  <Text style={styles.title}>{title}</Text>
                  {subtitle ? (
                    <Text style={styles.subtitle}>{subtitle}</Text>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.card}>{children}</View>

              {footer ? <View style={styles.footer}>{footer}</View> : null}

              {illustration ? (
                <View style={styles.illustration}>{illustration}</View>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  topStrip: { backgroundColor: colors.ink, width: '100%' },
  bg: { flex: 1 },
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    // Roomy top spacing — title sits well below the status-bar strip,
    // closer to the vertical optical center, with the form still
    // comfortably above the keyboard on a 6.1" phone.
    paddingTop: spacing['2xl'] * 3 + spacing.md,
    paddingBottom: spacing.lg,
  },
  // Tight variant — used when the card holds its own header (step
  // progress widget) and the page-level headline is hidden.
  scrollTight: { paddingTop: spacing.md },
  headline: { alignItems: 'center', marginBottom: spacing.md },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    padding: spacing.lg,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 6,
  },
  footer: { marginTop: spacing.lg, alignItems: 'center' },
  illustration: { marginTop: spacing.xl, alignItems: 'center' },
});
