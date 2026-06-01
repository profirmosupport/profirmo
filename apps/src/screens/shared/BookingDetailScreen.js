import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { getBooking } from '../../services/bookingService';
import { formatDate, formatRupees } from '../../utils/formatters';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function BookingDetailScreen({ route }) {
  const { bookingId } = route.params || {};
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const b = await getBooking(bookingId);
        if (active) setBooking((b && b.booking) || b);
      } catch (err) {
        if (active) setError(err.message || 'Failed to load booking.');
      }
    })();
    return () => {
      active = false;
    };
  }, [bookingId]);

  if (error) {
    return (
      <ScreenContainer>
        <Text style={styles.error}>{error}</Text>
      </ScreenContainer>
    );
  }
  if (!booking) {
    return (
      <ScreenContainer>
        <Text style={styles.muted}>Loading…</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Card>
        <View style={styles.row}>
          <Text style={styles.title}>Booking</Text>
          <Badge variant="amber">{booking.status}</Badge>
        </View>
        <Field label="Date" value={formatDate(booking.date)} />
        <Field label="Time" value={booking.time || '—'} />
        <Field label="Duration" value={`${booking.duration || 0} min`} />
        <Field
          label="Estimated cost"
          value={
            booking.estimatedCost
              ? formatRupees(booking.estimatedCost)
              : '—'
          }
        />
        {booking.notes ? <Field label="Notes" value={booking.notes} /> : null}
      </Card>
    </ScreenContainer>
  );
}

function Field({ label, value }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  field: { marginTop: spacing.sm },
  label: { fontSize: fontSize.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { marginTop: 2, fontSize: fontSize.base, color: colors.textPrimary },
  muted: { color: colors.textSecondary },
  error: { color: colors.danger },
});
