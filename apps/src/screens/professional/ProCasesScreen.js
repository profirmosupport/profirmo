import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { listMyCases } from '../../services/caseService';
import { formatDate } from '../../utils/formatters';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function ProCasesScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listMyCases();
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
          icon="folder"
          title="No cases yet"
          description="Cases assigned to you will appear here. Convert a booking from your bookings list to start one."
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
                navigation.navigate('CaseDetail', { caseId: item.id })
              }
            >
              <Card>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{item.title || item.id}</Text>
                    <Text style={styles.subtitle}>
                      {item.category || item.caseType || 'Case'} · opened{' '}
                      {formatDate(item.createdAt)}
                    </Text>
                  </View>
                  {item.status ? (
                    <Badge variant="amber">{item.status}</Badge>
                  ) : null}
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  subtitle: { marginTop: 2, fontSize: fontSize.sm, color: colors.textSecondary },
});
