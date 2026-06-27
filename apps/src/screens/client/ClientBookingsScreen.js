// ClientBookingsScreen — mobile mirror of /dashboard/client/bookings.
// Each row is a card with the professional's avatar + name + type,
// the "when" + duration + cost, and a status pill. Tapping the row
// drops into the detail screen.

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import AvatarWithInitials from '../../components/common/AvatarWithInitials';
import { listMyBookings } from '../../services/bookingService';
import { formatDate, formatRupees } from '../../utils/formatters';
import { formatSlotLabel } from '../../utils/availability';
import { imageUrl } from '../../utils/imageUrl';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const STATUS_VARIANT = {
  pending: 'amber',
  confirmed: 'amber',
  completed: 'gray',
  cancelled: 'gray',
};

export default function ClientBookingsScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listMyBookings();
      setRows(Array.isArray(r) ? r : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScreenContainer scroll={false} hasNavHeader>
      {!loading && rows.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No bookings yet"
          description="Consultations you book with professionals will appear here."
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          onRefresh={load}
          refreshing={loading}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={
            <View style={styles.summaryRow}>
              <View style={styles.summaryIcon}>
                <Feather name="calendar" size={14} color={colors.primary} />
              </View>
              <Text style={styles.summaryText}>
                {loading
                  ? 'Loading…'
                  : `${rows.length} booking${rows.length === 1 ? '' : 's'}`}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <BookingRow
              booking={item}
              onPress={() =>
                navigation.navigate('BookingDetail', { bookingId: item.id })
              }
            />
          )}
        />
      )}
    </ScreenContainer>
  );
}

function BookingRow({ booking, onPress }) {
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
      ? `${formatDate(booking.date)}${booking.time ? ` · ${formatSlotLabel(booking.time)}` : ''}`
      : '—';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
      <Card>
        <View style={styles.headRow}>
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
          <Badge variant={STATUS_VARIANT[status] || 'gray'}>{status}</Badge>
        </View>

        <View style={styles.metaRow}>
          <MetaItem icon="clock" label={whenLabel} />
          {booking.duration ? (
            <MetaItem icon="watch" label={`${booking.duration} min`} />
          ) : null}
          {booking.estimatedCost ? (
            <MetaItem
              icon="credit-card"
              label={formatRupees(booking.estimatedCost)}
            />
          ) : null}
        </View>

        <View style={styles.actionRow}>
          <Feather name="eye" size={12} color={colors.primary} />
          <Text style={styles.actionText}>View details</Text>
        </View>
      </Card>
    </Pressable>
  );
}

function MetaItem({ icon, label }) {
  return (
    <View style={styles.metaItem}>
      <Feather name={icon} size={11} color={colors.textMuted} />
      <Text style={styles.metaText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  summaryIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },

  headRow: {
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

  metaRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaItem: {
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

  actionRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  actionText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    letterSpacing: 0.2,
  },
});
