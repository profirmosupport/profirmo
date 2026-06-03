// TalkToFirmoScreen — placeholder for the AI assistant entry. The
// floating tab-bar button leads here. Once the real chat backend
// lands we'll swap the placeholder for the conversation UI.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../../components/common/ScreenContainer';
import { useAuth } from '../../contexts/AuthContext';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const STARTER_PROMPTS = [
  'How do I file ITR after the new Income-tax Act 2025?',
  'What does GST registration cost for a small business?',
  'When do I need a contract reviewed by a lawyer?',
  'How can I dispute a service company’s charges?',
];

export default function TalkToFirmoScreen() {
  const { exitGuest } = useAuth();
  return (
    <ScreenContainer hasNavHeader>
      <LinearGradient
        colors={['#0b1220', '#0f172a', '#1e293b']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroIcon}>
          <Feather name="message-circle" size={28} color={colors.primary} />
        </View>
        <Text style={styles.heroTitle}>Talk to Firmo</Text>
        <Text style={styles.heroBody}>
          Our AI assistant answers tax, legal and compliance questions in
          plain English — and connects you with a verified professional
          when it can’t.
        </Text>
        <View style={styles.heroPill}>
          <Feather name="zap" size={11} color={colors.primary} />
          <Text style={styles.heroPillText}>Coming soon</Text>
        </View>
      </LinearGradient>

      <Text style={styles.sectionLabel}>Try asking…</Text>
      <View style={{ gap: spacing.sm }}>
        {STARTER_PROMPTS.map((p) => (
          <Pressable
            key={p}
            onPress={() => {}}
            style={({ pressed }) => [
              styles.prompt,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Feather name="message-square" size={14} color={colors.textSecondary} />
            <Text style={styles.promptText}>{p}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Want to keep your chats? Create an account.
        </Text>
        <Pressable
          onPress={exitGuest}
          style={({ pressed }) => [
            styles.signupBtn,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.signupBtnText}>Sign up — free</Text>
          <Feather name="arrow-right" size={14} color={colors.primary} />
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(217,119,6,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: -0.2,
  },
  heroBody: {
    marginTop: 6,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 20,
  },
  heroPill: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(217,119,6,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.32)',
  },
  heroPillText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  sectionLabel: {
    marginTop: spacing.lg,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  promptText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 19,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    gap: 8,
  },
  footerText: { fontSize: fontSize.sm, color: colors.textSecondary },
  signupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  signupBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
});
