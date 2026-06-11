import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Section from '../../components/common/Section';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import AvatarWithInitials from '../../components/common/AvatarWithInitials';
import DashboardHero from '../../components/common/DashboardHero';
import DashboardLoader from '../../components/common/DashboardLoader';
import { CardSkeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { listMyBookings } from '../../services/bookingService';
import { displayName, formatDate, formatRupees } from '../../utils/formatters';
import { imageUrl } from '../../utils/imageUrl';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

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

  // Refetch on focus so a freshly-paid booking lands here instantly
  // when the user navigates back from the booking flow. We also flip
  // `loadedOnce` to false BEFORE the fetch so the branded loader
  // shows on every entry — the user sees the same animated splash
  // every time, not just on cold start.
  useFocusEffect(
    useCallback(() => {
      setLoadedOnce(false);
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

  // First-paint brand loader — same vibe as the guest landing's
  // GuestHomeLoader. Once the first fetch lands we swap to the
  // real dashboard.
  if (!loadedOnce) {
    return (
      <DashboardLoader
        greeting={`Hi, ${firstName} · ${greeting()}`}
        tagline="Loading your dashboard…"
        tileCount={3}
      />
    );
  }

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={load} bleedTop>
      <DashboardHero
        eyebrow={`Hi, ${firstName}`}
        title={greeting()}
        subtitle="Find an expert and book in minutes."
        trailingPill="Client"
        trailingPillTone="ghost"
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
            // React-navigation walks up the navigator tree until it
            // finds one that owns the `GuestSearch` tab — so calling
            // navigate() directly from inside AccountStack still hits
            // the bottom-tab navigator. Falling back to the explicit
            // getParent chain guards against any future restructure
            // where the tree depth changes.
            try {
              navigation.navigate('GuestSearch', {
                screen: 'GuestSearchMain',
                initial: false,
              });
              return;
            } catch {}
            try {
              const tabs = navigation.getParent?.()?.getParent?.();
              tabs?.navigate?.('GuestSearch', {
                screen: 'GuestSearchMain',
                initial: false,
              });
            } catch {}
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
        style={styles.upcomingSection}
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
          upcoming.map((b) => <DashboardBookingRow key={b.id} booking={b} navigation={navigation} />)
        )}
      </Section>
    </ScreenContainer>
  );
}

// Inline booking row — same shape as the My Bookings list so the
// dashboard and full listing read as one experience. Photo of the
// professional + name + designation, status pill, then meta chips.
function DashboardBookingRow({ booking, navigation }) {
  const pro = booking.professional || {};
  const photoUrl = imageUrl(pro.profilePhoto);
  const proName = pro.name || booking.professionalName || 'Professional';
  const proSubtitle =
    pro.designation || pro.professionalType || booking.professionalType || '';
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
            name={proName}
            size={44}
            style={{ borderRadius: 22 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.proName} numberOfLines={1}>
              {proName}
            </Text>
            {proSubtitle ? (
              <Text style={styles.proSub} numberOfLines={1}>
                {proSubtitle}
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
  // Breathing room between the QuickAction row and the Upcoming
  // bookings heading — the default Section margin sat too close.
  upcomingSection: { marginTop: spacing.lg },

  // Inline booking row — same look as the My Bookings list.
  bookingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  proName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  proSub: {
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
