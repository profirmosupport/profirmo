import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { listMyPayments } from '../../services/paymentService';
import { listMySubscriptionPayments } from '../../services/subscriptionService';
import { formatDate, formatINR } from '../../utils/formatters';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

// Merged booking + subscription payment history for the professional.
// Mirrors the web /dashboard/professional/payments page.

function asSubscriptionRow(s) {
  return {
    id: s.id,
    kind: 'subscription',
    capturedAt: s.paymentDate || s.createdAt,
    title:
      (s.plan && s.plan.name)
        ? `${s.plan.name} (${s.billingCycle})`
        : `Subscription (${s.billingCycle})`,
    amount: Number(s.totalAmount || s.amount || 0) * 100,
    status: s.paymentStatus,
    paymentId: s.transactionId,
  };
}

function asBookingRow(b) {
  return {
    id: b.id,
    kind: 'booking',
    capturedAt: b.capturedAt || b.createdAt,
    title:
      b.booking && b.booking.date
        ? `${formatDate(b.booking.date)}${b.booking.time ? ' ' + b.booking.time : ''}`
        : 'Booking payment',
    counterparty: b.counterpartyName,
    amount: b.amount,
    platformFee: b.platformFee,
    netAmount: b.netAmount,
    status: b.status,
    paymentId: b.razorpayPaymentId,
  };
}

export default function ProPaymentsScreen() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bk, sub] = await Promise.all([
        listMyPayments('professional').catch(() => []),
        listMySubscriptionPayments().catch(() => []),
      ]);
      const merged = [
        ...bk.map(asBookingRow),
        ...sub.map(asSubscriptionRow),
      ].sort((a, b) => {
        const ka = new Date(a.capturedAt || 0).getTime();
        const kb = new Date(b.capturedAt || 0).getTime();
        return kb - ka;
      });
      setRows(merged);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScreenContainer scroll={false} hasNavHeader>
      {!loading && rows.length === 0 ? (
        <EmptyState
          icon="credit-card"
          title="No payments yet"
          description="Booking payouts and subscription charges will show up here."
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          onRefresh={load}
          refreshing={loading}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => (
            <Card>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <View style={styles.kindRow}>
                    <Badge variant={item.kind === 'subscription' ? 'violet' : 'amber'}>
                      {item.kind === 'subscription' ? 'Subscription' : 'Booking'}
                    </Badge>
                    {item.status ? (
                      <Badge
                        variant={
                          item.status === 'paid' ? 'green' : item.status === 'failed' ? 'red' : 'gray'
                        }
                      >
                        {item.status}
                      </Badge>
                    ) : null}
                  </View>
                  <Text style={styles.title}>{item.title}</Text>
                  {item.counterparty ? (
                    <Text style={styles.muted}>{item.counterparty}</Text>
                  ) : null}
                  <Text style={styles.amount}>{formatINR(item.amount)}</Text>
                  {item.kind === 'booking' && item.platformFee ? (
                    <Text style={styles.muted}>
                      Platform fee {formatINR(item.platformFee)} · Net{' '}
                      {formatINR(item.netAmount || 0)}
                    </Text>
                  ) : null}
                  {item.paymentId ? (
                    <Text style={styles.paymentId}>{item.paymentId}</Text>
                  ) : null}
                  <Text style={styles.date}>{formatDate(item.capturedAt)}</Text>
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  kindRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  muted: { marginTop: 2, fontSize: fontSize.sm, color: colors.textSecondary },
  amount: { marginTop: 4, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary },
  paymentId: { marginTop: 4, fontSize: fontSize.xs, color: colors.textMuted, fontFamily: 'Menlo' },
  date: { marginTop: 4, fontSize: fontSize.xs, color: colors.textMuted },
});
