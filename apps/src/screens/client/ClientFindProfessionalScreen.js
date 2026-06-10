import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { listProfessionals } from '../../services/professionalService';
import { formatRupees } from '../../utils/formatters';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function ClientFindProfessionalScreen({ navigation }) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listProfessionals({ search });
      setItems((res && res.items) || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <ScreenContainer scroll={false} hasNavHeader keyboard>
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or specialization"
          autoCapitalize="none"
        />
      </View>
      {!loading && items.length === 0 ? (
        <EmptyState
          icon="search"
          title="No professionals found"
          description="Try a different search term."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          onRefresh={load}
          refreshing={loading}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate('ProfessionalDetail', { professionalId: item.id })
              }
            >
              <Card>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>
                      {item.fullName ||
                        item.name ||
                        `${item.firstName || ''} ${item.lastName || ''}`.trim()}
                    </Text>
                    {item.designation || item.professionalType ? (
                      <Text style={styles.subtitle}>
                        {item.designation || item.professionalType}
                      </Text>
                    ) : null}
                    <View style={styles.badges}>
                      {item.city ? <Badge variant="gray">{item.city}</Badge> : null}
                      {item.rating ? <Badge variant="amber">★ {item.rating}</Badge> : null}
                    </View>
                  </View>
                  {item.consultationFee ? (
                    <Text style={styles.fee}>
                      {formatRupees(item.consultationFee)}
                    </Text>
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
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  subtitle: { marginTop: 2, fontSize: fontSize.sm, color: colors.textSecondary },
  badges: { marginTop: 6, flexDirection: 'row', gap: 6 },
  fee: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.primary },
});
