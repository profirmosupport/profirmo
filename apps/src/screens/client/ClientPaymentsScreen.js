import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { listMyPayments } from '../../services/paymentService';
import { formatDate, formatINR } from '../../utils/formatters';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function ClientPaymentsScreen() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listMyPayments('client');
      setRows(r || []);
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
          icon="credit-card"
          title="No payments yet"
          description="Your booking payments will show up here."
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
                  <Text style={styles.title}>
                    {item.counterpartyName || 'Professional'}
                  </Text>
                  <Text style={styles.muted}>
                    {formatDate(item.capturedAt || item.createdAt)}
                  </Text>
                  {item.razorpayPaymentId ? (
                    <Text style={styles.paymentId}>
                      {item.razorpayPaymentId}
                    </Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.amount}>{formatINR(item.amount)}</Text>
                  <Badge
                    variant={
                      item.status === 'paid' ? 'green' : item.status === 'failed' ? 'red' : 'gray'
                    }
                  >
                    {item.status}
                  </Badge>
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
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  muted: { marginTop: 2, fontSize: fontSize.sm, color: colors.textSecondary },
  paymentId: { marginTop: 4, fontSize: fontSize.xs, color: colors.textMuted, fontFamily: 'Menlo' },
  amount: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: 4 },
});
