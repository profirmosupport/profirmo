import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import EmptyState from '../../components/common/EmptyState';
import { CardSkeleton } from '../../components/common/Skeleton';
import { listNotifications, markAllRead } from '../../services/notificationService';
import { formatDate } from '../../utils/formatters';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function NotificationsScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listNotifications();
      setItems(rows);
      markAllRead().catch(() => {});
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScreenContainer scroll={false}>
      {loading ? (
        <View style={{ padding: 16, gap: 8 }}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No notifications yet"
          description="When you have new bookings, messages or case updates they will show up here."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          onRefresh={load}
          refreshing={loading}
          renderItem={({ item }) => (
            <Card>
              <Text style={styles.title}>{item.title || item.type}</Text>
              {item.message ? (
                <Text style={styles.body}>{item.message}</Text>
              ) : null}
              <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>
            </Card>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: { padding: spacing.lg, color: colors.textSecondary },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  body: { marginTop: 4, fontSize: fontSize.sm, color: colors.textSecondary },
  meta: { marginTop: 6, fontSize: fontSize.xs, color: colors.textMuted },
});
