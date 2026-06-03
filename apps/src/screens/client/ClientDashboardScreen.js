import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Section from '../../components/common/Section';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import HeroHeader from '../../components/common/HeroHeader';
import { CardSkeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { listMyBookings } from '../../services/bookingService';
import { displayName, formatDate, formatRupees } from '../../utils/formatters';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const QUICK_TONES = {
  amber: { bg: colors.primarySoft, fg: colors.primary },
  emerald: { bg: colors.successSoft, fg: colors.success },
  sky: { bg: colors.infoSoft, fg: colors.info },
};

function QuickAction({ icon, label, tone, onPress }) {
  const t = QUICK_TONES[tone] || QUICK_TONES.amber;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickTile,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.quickIcon, { backgroundColor: t.bg }]}>
        <Feather name={icon} size={18} color={t.fg} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

export default function ClientDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await listMyBookings();
      setBookings(r || []);
    } catch {
      setBookings([]);
    } finally {
      setRefreshing(false);
      setLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const firstName = displayName(user).split(' ')[0] || 'there';
  const upcoming = bookings
    .filter((b) =>
      ['pending', 'confirmed'].includes(String(b.status || '').toLowerCase())
    )
    .slice(0, 3);

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={load}>
      <HeroHeader
        eyebrow={`Hi, ${firstName}`}
        title={greeting()}
        subtitle="Find an expert and book in minutes."
        trailingIcon="bell"
        onTrailingPress={() => navigation.navigate('AccountNotifications')}
      />

      <Card style={{ marginTop: spacing.lg }}>
        <View style={styles.ctaRow}>
          <View style={styles.ctaIcon}>
            <Feather name="user-check" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>Talk to a professional</Text>
            <Text style={styles.muted}>
              Lawyers, CAs, tax experts — verified and available now.
            </Text>
          </View>
        </View>
        <Button
          title="Find a professional"
          icon={<Feather name="search" size={14} color={colors.textInverse} />}
          style={{ marginTop: spacing.md }}
          onPress={() => {
            const parent = navigation.getParent?.()?.getParent?.();
            parent?.navigate?.('GuestSearch', { screen: 'GuestSearchMain' });
          }}
        />
      </Card>

      <View style={styles.quickRow}>
        <QuickAction
          icon="calendar"
          label="My bookings"
          tone="amber"
          onPress={() =>
            navigation.navigate('AccountBookings')
          }
        />
        <QuickAction
          icon="folder"
          label="My cases"
          tone="emerald"
          onPress={() => navigation.navigate('AccountCases')}
        />
        <QuickAction
          icon="credit-card"
          label="Payments"
          tone="sky"
          onPress={() => navigation.navigate('AccountPayments')}
        />
      </View>

      <Section
        title="Upcoming bookings"
        action={
          <Pressable
            onPress={() =>
              navigation.navigate('AccountBookings')
            }
          >
            <Text style={styles.link}>See all</Text>
          </Pressable>
        }
      >
        {!loadedOnce ? (
          <CardSkeleton />
        ) : upcoming.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="Nothing upcoming"
            description="Book a consultation to get started."
          />
        ) : (
          upcoming.map((b) => (
            <Pressable
              key={b.id}
              onPress={() =>
                navigation.navigate('AccountBookingDetail', {
                  bookingId: b.id,
                })
              }
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Card style={{ marginBottom: spacing.sm }}>
                <View style={styles.row}>
                  <View style={styles.calBubble}>
                    <Feather name="calendar" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookingTitle}>
                      {formatDate(b.date)}{b.time ? ` · ${b.time}` : ''}
                    </Text>
                    <Text style={styles.muted}>
                      {b.professionalName || 'Professional'}
                      {b.estimatedCost
                        ? ` · ${formatRupees(b.estimatedCost)}`
                        : ''}
                    </Text>
                  </View>
                  <Badge variant="amber">{b.status}</Badge>
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </Section>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  muted: { marginTop: 2, fontSize: fontSize.sm, color: colors.textSecondary },
  quickRow: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm },
  quickTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickLabel: { fontSize: 11, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  link: { color: colors.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bookingTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  calBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
