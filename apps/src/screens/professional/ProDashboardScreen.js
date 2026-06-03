import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Section from '../../components/common/Section';
import DashboardHero from '../../components/common/DashboardHero';
import StatTile from '../../components/common/StatTile';
import { CardSkeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { getMySubscription, getMyUsage } from '../../services/subscriptionService';
import { listMyBookings } from '../../services/bookingService';
import { displayName, formatDate } from '../../utils/formatters';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function ProDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const results = await Promise.allSettled([
      getMySubscription(),
      getMyUsage(),
      listMyBookings(),
    ]);
    if (results[0].status === 'fulfilled') setSubscription(results[0].value);
    if (results[1].status === 'fulfilled') setUsage(results[1].value);
    if (results[2].status === 'fulfilled') setBookings(results[2].value || []);
    setRefreshing(false);
    setLoadedOnce(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const firstName = displayName(user).split(' ')[0] || 'there';
  const upcoming = bookings
    .filter((b) => ['pending', 'confirmed'].includes(String(b.status || '').toLowerCase()))
    .slice(0, 3);

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={load} bleedTop>
      <DashboardHero
        eyebrow={`Welcome back, ${firstName}`}
        title={greeting()}
        subtitle="Here's your day at a glance."
        trailingPill={
          (subscription && subscription.plan && subscription.plan.name) ||
          'Free'
        }
        trailingPillTone="amber"
      />

      <Card style={{ marginTop: spacing.lg }}>
        <View style={styles.subHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Current plan</Text>
            <Text style={styles.planName}>
              {(subscription && subscription.plan && subscription.plan.name) ||
                'No active plan'}
            </Text>
            {subscription && subscription.endDate ? (
              <Text style={styles.muted}>
                Renews / expires {formatDate(subscription.endDate)}
              </Text>
            ) : null}
          </View>
          {subscription ? (
            <Badge variant={subscription.paymentStatus === 'paid' ? 'green' : 'amber'}>
              {subscription.paymentStatus}
            </Badge>
          ) : null}
        </View>
        <Pressable
          onPress={() => navigation.navigate('AccountSubscription')}
          style={({ pressed }) => [styles.ctaRow, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={styles.ctaText}>Manage subscription</Text>
          <Feather name="arrow-right" size={14} color={colors.primary} />
        </Pressable>
      </Card>

      {usage ? (
        <View style={styles.tileGrid}>
          <StatTile
            icon="folder"
            tone="amber"
            label="Cases"
            value={(usage.cases && usage.cases.used) ?? '—'}
            limit={usage.cases && (usage.cases.unlimited ? '∞' : usage.cases.limit)}
          />
          <StatTile
            icon="briefcase"
            tone="violet"
            label="Firms"
            value={(usage.firms && usage.firms.used) ?? '—'}
            limit={usage.firms && (usage.firms.unlimited ? '∞' : usage.firms.limit)}
          />
          {usage.firmMembers ? (
            <StatTile
              icon="users"
              tone="sky"
              label="Firm team"
              value={usage.firmMembers.used}
              limit={usage.firmMembers.unlimited ? '∞' : usage.firmMembers.limit}
            />
          ) : null}
          {usage.firmCases ? (
            <StatTile
              icon="layers"
              tone="emerald"
              label="Firm cases"
              value={usage.firmCases.used}
              limit={usage.firmCases.unlimited ? '∞' : usage.firmCases.limit}
            />
          ) : null}
        </View>
      ) : !loadedOnce ? (
        <View style={styles.tileGrid}>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : null}

      <Section
        title="Upcoming bookings"
        subtitle={`${upcoming.length} on your calendar`}
        action={
          <Pressable
            onPress={() => navigation.navigate('AccountBookings')}
          >
            <Text style={styles.linkText}>See all</Text>
          </Pressable>
        }
      >
        {!loadedOnce ? (
          <CardSkeleton />
        ) : upcoming.length === 0 ? (
          <Card>
            <Text style={styles.muted}>No upcoming bookings.</Text>
          </Card>
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
                <View style={styles.bookingRow}>
                  <View style={styles.calBubble}>
                    <Feather name="calendar" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookingTitle}>
                      {formatDate(b.date)}{b.time ? ` · ${b.time}` : ''}
                    </Text>
                    <Text style={styles.muted}>
                      {b.duration ? `${b.duration} min` : ''}
                      {b.clientName ? ` · ${b.clientName}` : ''}
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
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  planName: { marginTop: 4, fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  muted: { marginTop: 4, fontSize: fontSize.sm, color: colors.textSecondary },
  ctaRow: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6 },
  ctaText: { color: colors.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
  tileGrid: { marginTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  linkText: { color: colors.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
  bookingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
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
