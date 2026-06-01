import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { listMyBookings } from '../../services/bookingService';
import { formatDate, formatRupees } from '../../utils/formatters';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function ClientBookingsScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listMyBookings();
      setRows(r || []);
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
    <ScreenContainer scroll={false}>
      {!loading && rows.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No bookings yet"
          description="Book a consultation from the Find tab."
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          onRefresh={load}
          refreshing={loading}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate('BookingDetail', { bookingId: item.id })
              }
            >
              <Card>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>
                      {formatDate(item.date)}{item.time ? ` · ${item.time}` : ''}
                    </Text>
                    <Text style={styles.muted}>
                      {item.professionalName || 'Professional'}
                      {item.estimatedCost
                        ? ` · ${formatRupees(item.estimatedCost)}`
                        : ''}
                    </Text>
                  </View>
                  <Badge variant="amber">{item.status}</Badge>
                </View>
              </Card>
            </Pressable>
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
});
