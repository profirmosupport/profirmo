// GuestSupportScreen — simple help center entry: WhatsApp, email,
// and a FAQ stub. Real ticketing happens through the web for now.

import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const CHANNELS = [
  {
    key: 'email',
    icon: 'mail',
    title: 'Email support',
    body: 'support@profirmo.com',
    href: 'mailto:support@profirmo.com',
  },
  {
    key: 'whatsapp',
    icon: 'message-circle',
    title: 'WhatsApp',
    body: 'Chat with a human on weekdays.',
    href: 'https://wa.me/911234567890',
  },
  {
    key: 'web',
    icon: 'globe',
    title: 'Help center',
    body: 'help.profirmo.com',
    href: 'https://profirmo.com/help',
  },
];

export default function GuestSupportScreen() {
  return (
    <ScreenContainer>
      <Text style={styles.title}>How can we help?</Text>
      <Text style={styles.subhead}>
        We typically reply within 24 hours on business days.
      </Text>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        {CHANNELS.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => Linking.openURL(c.href).catch(() => {})}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Card>
              <View style={styles.row}>
                <View style={styles.iconBubble}>
                  <Feather name={c.icon} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{c.title}</Text>
                  <Text style={styles.rowBody}>{c.body}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </View>
            </Card>
          </Pressable>
        ))}
      </View>

      <View style={styles.note}>
        <Feather name="info" size={14} color={colors.textMuted} />
        <Text style={styles.noteText}>
          For booking-specific issues, create an account so we can find your
          payments and case files.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  subhead: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  rowBody: { marginTop: 2, fontSize: fontSize.sm, color: colors.textSecondary },
  note: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
  },
  noteText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 17,
  },
});
