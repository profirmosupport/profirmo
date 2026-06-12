// ProCasesScreen — mobile mirror of /dashboard/professional/cases.
// Lists every case assigned to the logged-in professional with the
// same column set the web's table renders (title, category, client,
// priority, status, next hearing, created). Tap a row → CaseDetail.

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
import { listMyCases } from '../../services/caseService';
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
          description="Cases assigned to you will appear here. Convert a booking from your bookings list to start one."
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
            <CaseRow item={item} />
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}

function CaseRow({ item }) {
  const assignees = Array.isArray(item.professionalIds)
    ? item.professionalIds.filter(Boolean)
    : [];
  const isFirmCase = assignees.length >= 2;
  const priority = item.priority || 'medium';
  const status = item.status || 'open';
  const clientName =
    (item.client && item.client.name) || item.clientName || item.clientId;
  const clientPhone = item.client && item.client.phone;

  return (
    <Card style={{ marginBottom: spacing.sm }}>
      {/* Header row — title + status badges */}
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title || item.id}
            </Text>
            {isFirmCase ? (
              <View style={styles.firmBadge}>
                <Feather name="briefcase" size={9} color="#6d28d9" />
                <Text style={styles.firmBadgeText}>Firm case</Text>
              </View>
            ) : null}
          </View>
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

      {/* Body — meta rows */}
      <View style={styles.metaGrid}>
        {clientName ? (
          <View style={styles.metaRow}>
            <Feather name="user" size={12} color={colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.metaValue} numberOfLines={1}>
                {clientName}
              </Text>
              {clientPhone ? (
                <Text style={styles.metaSub}>{clientPhone}</Text>
              ) : null}
            </View>
          </View>
        ) : null}
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
            Opened {formatDate(item.createdAt)}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  muted: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  badgeStack: { alignItems: 'flex-end', gap: 4 },

  firmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: '#ede9fe',
  },
  firmBadgeText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: '#6d28d9',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

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
  metaSub: { fontSize: 11, color: colors.textMuted },
});
