// ProDashboardScreen — landing inside the Account tab for signed-in
// professionals. Mirrors the client dashboard layout so both sides
// read the same: hero strip → CTA → icon tiles → upcoming bookings.

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Section from '../../components/common/Section';
import EmptyState from '../../components/common/EmptyState';
import AvatarWithInitials from '../../components/common/AvatarWithInitials';
import DashboardHero from '../../components/common/DashboardHero';
import { CardSkeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { getMySubscription } from '../../services/subscriptionService';
import { listMyBookingsAsProfessional } from '../../services/bookingService';
import { displayName, formatDate, formatRupees } from '../../utils/formatters';
import { imageUrl } from '../../utils/imageUrl';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatTime12h(value) {
  if (!value) return '';
  const [hStr, mStr] = String(value).split(':');
  const h = Number(hStr);
  const m = Number(mStr || 0);
  if (!Number.isFinite(h)) return value;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

const BOOKING_STATUS_VARIANT = {
  pending: 'amber',
  confirmed: 'amber',
  completed: 'gray',
  cancelled: 'gray',
};

const QUICK_TONES = {
  amber: { bg: colors.primarySoft, fg: colors.primary },
  emerald: { bg: colors.successSoft, fg: colors.success },
  sky: { bg: colors.infoSoft, fg: colors.info },
  violet: { bg: '#ede9fe', fg: '#7c3aed' },
};

// PlanQuotaGrid — four icon-led tiles showing the active plan's
// allowances: Commission, Cases, Firm, Support. Each tile gets a
// distinct colour so the row reads as four designed badges instead
// of four identical amber blocks.
function PlanQuotaGrid({ plan }) {
  if (!plan) return null;
  const cap = (s) =>
    s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '';
  const items = [
    {
      key: 'commission',
      label: 'Commission',
      icon: 'percent',
      iconBg: '#fee2e2',
      iconFg: '#be123c',
      value: `${Number(plan.commissionPercent || 0)}%`,
    },
    {
      key: 'cases',
      label: 'Cases',
      icon: 'folder',
      iconBg: '#fef3c7',
      iconFg: '#b45309',
      value: plan.unlimitedCases ? 'Unlimited' : `${plan.caseLimit ?? 0}`,
    },
    {
      key: 'firm',
      label: 'Firm',
      icon: 'briefcase',
      iconBg: '#ede9fe',
      iconFg: '#6d28d9',
      value: plan.firmCreationAllowed
        ? plan.unlimitedFirms
          ? 'Unlimited'
          : `${plan.firmLimit ?? 0}`
        : 'Not allowed',
    },
    {
      key: 'support',
      label: 'Support',
      icon: 'life-buoy',
      iconBg: '#d1fae5',
      iconFg: '#047857',
      value: cap(plan.supportType) || '—',
    },
  ];
  return (
    <View style={styles.quotaGrid}>
      {items.map((it) => (
        <View key={it.key} style={styles.quotaCell}>
          <View style={[styles.quotaIcon, { backgroundColor: it.iconBg }]}>
            <Feather name={it.icon} size={16} color={it.iconFg} />
          </View>
          <Text style={styles.quotaLabel}>{it.label}</Text>
          <Text style={styles.quotaValue} numberOfLines={1}>
            {it.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

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

export default function ProDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const results = await Promise.allSettled([
      getMySubscription(),
      listMyBookingsAsProfessional(),
    ]);
    if (results[0].status === 'fulfilled') setSubscription(results[0].value);
    if (results[1].status === 'fulfilled') setBookings(results[1].value || []);
    setRefreshing(false);
    setLoadedOnce(true);
  }, []);

  // useFocusEffect — refetch whenever the dashboard re-enters focus,
  // so a freshly-confirmed booking lands here on return from the
  // booking detail or the conversion flow.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const firstName = displayName(user).split(' ')[0] || 'there';
  // Show the 5 most recent upcoming bookings on the dashboard; the
  // full list lives on the My Bookings screen reached via "See all".
  const upcoming = bookings
    .filter((b) =>
      ['pending', 'confirmed'].includes(String(b.status || '').toLowerCase())
    )
    .slice(0, 5);

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

        {/* Plan allowances — surfaced from the active plan so the pro
            can see at a glance what they're entitled to. Matches the
            web subscription page's Snapshot grid. */}
        <PlanQuotaGrid plan={subscription && subscription.plan} />

        <Pressable
          onPress={() => navigation.navigate('AccountSubscription')}
          style={({ pressed }) => [styles.ctaRow, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={styles.ctaText}>Manage subscription</Text>
          <Feather name="arrow-right" size={14} color={colors.primary} />
        </Pressable>
      </Card>

      {/* Icon tile row — pure navigation shortcuts. No counts so the
          row reads as a primary nav, not a metrics summary. */}
      <View style={styles.quickRow}>
        <QuickAction
          icon="calendar"
          label="Booking"
          tone="amber"
          onPress={() => navigation.navigate('AccountBookings')}
        />
        <QuickAction
          icon="folder"
          label="Cases"
          tone="emerald"
          onPress={() => navigation.navigate('AccountCases')}
        />
        <QuickAction
          icon="credit-card"
          label="Wallet"
          tone="sky"
          onPress={() => navigation.navigate('AccountWallet')}
        />
        <QuickAction
          icon="briefcase"
          label="Firm"
          tone="violet"
          onPress={() => navigation.navigate('AccountFirm')}
        />
      </View>

      <Section
        title="Upcoming bookings"
        style={styles.upcomingSection}
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
          <EmptyState
            icon="calendar"
            title="Nothing upcoming"
            description="Confirmed bookings will show up here."
          />
        ) : (
          upcoming.map((b) => (
            <DashboardBookingRow key={b.id} booking={b} navigation={navigation} />
          ))
        )}
      </Section>
    </ScreenContainer>
  );
}

// Inline booking row mirrors the client-dashboard layout, but for the
// pro side it surfaces the CLIENT's avatar + name (since the pro is
// the viewer). Falls back gracefully when the snapshot is missing.
function DashboardBookingRow({ booking, navigation }) {
  const client = booking.client || {};
  const photoUrl = imageUrl(client.profilePhoto);
  const clientName = client.name || booking.clientName || 'Client';
  const subtitle = client.email || client.phone || '';
  const status = String(booking.status || 'pending').toLowerCase();
  const isInstant = String(booking.type || '').toLowerCase() === 'instant';
  const whenLabel = isInstant
    ? 'Instant · Now'
    : booking.date
      ? `${formatDate(booking.date)}${booking.time ? ` · ${formatTime12h(booking.time)}` : ''}`
      : '—';
  return (
    <Pressable
      onPress={() =>
        navigation.navigate('AccountBookingDetail', { bookingId: booking.id })
      }
      style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
    >
      <Card style={{ marginBottom: spacing.sm }}>
        <View style={styles.bookingHead}>
          <AvatarWithInitials
            uri={photoUrl}
            name={clientName}
            size={44}
            style={{ borderRadius: 22 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.clientName} numberOfLines={1}>
              {clientName}
            </Text>
            {subtitle ? (
              <Text style={styles.clientSub} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Badge variant={BOOKING_STATUS_VARIANT[status] || 'gray'}>
            {status}
          </Badge>
        </View>

        <View style={styles.metaPills}>
          <MetaPill icon="clock" label={whenLabel} />
          {booking.duration ? (
            <MetaPill icon="watch" label={`${booking.duration} min`} />
          ) : null}
          {booking.estimatedCost ? (
            <MetaPill
              icon="credit-card"
              label={formatRupees(booking.estimatedCost)}
            />
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

function MetaPill({ icon, label }) {
  return (
    <View style={styles.metaPill}>
      <Feather name={icon} size={11} color={colors.textMuted} />
      <Text style={styles.metaText} numberOfLines={1}>
        {label}
      </Text>
    </View>
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

  // Plan allowance grid — four icon-led tiles laid out as a single
  // row. No wrap, so the row always reads as one strip of four
  // designed allowances side-by-side.
  quotaGrid: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'flex-start',
    gap: 6,
  },
  // Flat cell — no border, no background, just an icon badge + label
  // + value, equally distributed across the row.
  quotaCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  quotaIcon: {
    // Fully round so the icon sits inside a designed badge — the
    // per-tile colour is supplied at render time.
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quotaLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  quotaValue: {
    marginTop: 2,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  // Icon-tile row
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
  quickLabel: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  // Bookings
  upcomingSection: { marginTop: spacing.lg },
  linkText: { color: colors.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
  bookingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clientName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  clientSub: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textSecondary,
  },
  metaPills: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
    maxWidth: 180,
  },
});
