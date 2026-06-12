// ClientCasesScreen — mobile mirror of /dashboard/client/cases.
// Shows every case filed for the logged-in client across all the
// professionals they've engaged. Same column set as the web table.

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { listMyClientCases } from '../../services/caseService';
import { formatDate } from '../../utils/formatters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const PRIORITY_VARIANT = {
  low: 'gray',
  medium: 'gray',
  high: 'amber',
  urgent: 'red',
};

const STATUS_VARIANT = {
  open: 'blue',
  'in-progress': 'amber',
  closed: 'green',
};

const STATUS_LABEL = {
  open: 'Open',
  'in-progress': 'In progress',
  closed: 'Closed',
};

function professionalsFor(c) {
  if (Array.isArray(c.professionals) && c.professionals.length > 0) {
    return c.professionals;
  }
  if (c.professional) return [c.professional];
  if (c.professionalId) {
    return [{ publicId: c.professionalId, name: c.professionalId }];
  }
  return [];
}

export default function ClientCasesScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listMyClientCases();
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

  if (loading && rows.length === 0) {
    return (
      <ScreenContainer hasNavHeader>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (rows.length === 0) {
    return (
      <ScreenContainer hasNavHeader>
        <EmptyState
          icon="folder"
          title="No cases yet"
          description="Cases filed for you by a professional or firm will appear here."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false} hasNavHeader>
      <View style={styles.headerStrip}>
        <Text style={styles.count}>
          {rows.length} case{rows.length === 1 ? '' : 's'}
        </Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        onRefresh={load}
        refreshing={loading}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              navigation.navigate('CaseDetail', { caseId: item.id })
            }
            style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
          >
            <ClientCaseRow item={item} />
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}

function ClientCaseRow({ item }) {
  const priority = item.priority || 'medium';
  const status = item.status || 'open';
  const pros = professionalsFor(item);

  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title || item.id}
          </Text>
          {item.category ? (
            <Text style={styles.muted}>{item.category}</Text>
          ) : null}
        </View>
        <View style={styles.badgeStack}>
          <Badge variant={STATUS_VARIANT[status] || 'gray'}>
            {STATUS_LABEL[status] || status}
          </Badge>
          <Badge variant={PRIORITY_VARIANT[priority] || 'gray'}>
            {priority}
          </Badge>
        </View>
      </View>

      <View style={styles.metaGrid}>
        <View style={styles.metaRow}>
          <Feather name="user-check" size={12} color={colors.textMuted} />
          {pros.length === 0 ? (
            <Text style={styles.metaSub}>Unassigned</Text>
          ) : (
            <View style={styles.proPills}>
              {pros.map((p) => (
                <View
                  key={p.publicId || p.id || p.name}
                  style={styles.proPill}
                >
                  <Text style={styles.proPillText} numberOfLines={1}>
                    {p.name || p.publicId}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
        {item.nextHearingDate ? (
          <View style={styles.metaRow}>
            <Feather name="calendar" size={12} color={colors.textMuted} />
            <Text style={styles.metaValue}>
              Next hearing {formatDate(item.nextHearingDate)}
            </Text>
          </View>
        ) : null}
        <View style={styles.metaRow}>
          <Feather name="clock" size={12} color={colors.textMuted} />
          <Text style={styles.metaValue}>
            Filed {formatDate(item.createdAt)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  headerStrip: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  count: { fontSize: fontSize.sm, color: colors.textSecondary },
  listContent: { padding: spacing.lg, paddingTop: 0 },

  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  muted: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  badgeStack: { alignItems: 'flex-end', gap: 4 },

  metaGrid: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaValue: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: fontWeight.semibold,
  },
  metaSub: { fontSize: 12, color: colors.textMuted },

  proPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1 },
  proPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  proPillText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
});
