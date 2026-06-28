// ProCasesScreen — mobile mirror of /dashboard/professional/cases.
// Lists every case assigned to the logged-in professional with the
// same client-side filters the web table exposes (search + stage +
// priority), plus a stage badge on each card so the workflow column
// is visible at a glance. Tap a row → CaseDetail.

import { useCallback, useMemo, useState } from 'react';
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
import CasesFilterBar from '../../components/cases/CasesFilterBar';
import AddCaseModal from '../../components/cases/AddCaseModal';
import { listMyCases } from '../../services/caseService';
import { getMyUsage } from '../../services/subscriptionService';
import {
  STAGE_LABEL,
  applyCaseFilters,
  emptyCaseFilter,
  isCaseFilterActive,
} from '../../utils/caseFilters';
import { formatDate } from '../../utils/formatters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const PRIORITY_VARIANT = {
  low: 'gray',
  medium: 'gray',
  high: 'amber',
  urgent: 'red',
};

export default function ProCasesScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(emptyCaseFilter());
  const [usage, setUsage] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Cases first; usage in parallel but tolerated to fail (the
      // button only shrinks to "Quota unknown" rather than blocking
      // creation entirely).
      const [r, u] = await Promise.allSettled([listMyCases(), getMyUsage()]);
      setRows(r.status === 'fulfilled' ? r.value || [] : []);
      if (u.status === 'fulfilled') setUsage(u.value || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const casesUsage = usage && usage.cases ? usage.cases : null;
  const quotaFull = !!(
    casesUsage &&
    !casesUsage.unlimited &&
    typeof casesUsage.remaining === 'number' &&
    casesUsage.remaining <= 0
  );

  const visible = useMemo(() => applyCaseFilters(rows, filter), [rows, filter]);
  const filterActive = isCaseFilterActive(filter);

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
        <View style={styles.headerStripEmpty}>
          {casesUsage ? <QuotaBanner usage={casesUsage} planName={usage?.planName} /> : null}
          <Pressable
            onPress={() => setAddOpen(true)}
            disabled={quotaFull}
            style={({ pressed }) => [
              styles.newCaseBtn,
              { opacity: quotaFull ? 0.55 : pressed ? 0.9 : 1 },
            ]}
          >
            <Feather name="plus" size={13} color="#ffffff" />
            <Text style={styles.newCaseText}>
              {quotaFull ? 'Plan limit reached' : 'New case'}
            </Text>
          </Pressable>
        </View>
        <EmptyState
          icon="folder"
          title="No cases yet"
          description="Tap “New case” above to add one — or convert a booking from your bookings list."
        />
        <AddCaseModal
          visible={addOpen}
          onClose={() => setAddOpen(false)}
          onCreated={(created) => {
            setAddOpen(false);
            if (created && created.id) {
              load();
              navigation.navigate('CaseDetail', { caseId: created.id });
            } else {
              load();
            }
          }}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false} hasNavHeader>
      <View style={styles.headerStrip}>
        <View style={styles.headerLeft}>
          <Text style={styles.count}>
            {rows.length} case{rows.length === 1 ? '' : 's'}
          </Text>
          {casesUsage ? (
            <Text style={styles.quotaPill}>
              {casesUsage.unlimited
                ? `Unlimited · ${usage?.planName || 'Plan'}`
                : `${casesUsage.used}/${casesUsage.limit} on ${
                    usage?.planName || 'plan'
                  }`}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => setAddOpen(true)}
          disabled={quotaFull}
          style={({ pressed }) => [
            styles.newCaseBtn,
            { opacity: quotaFull ? 0.55 : pressed ? 0.9 : 1 },
          ]}
        >
          <Feather name="plus" size={13} color="#ffffff" />
          <Text style={styles.newCaseText}>
            {quotaFull ? 'Limit reached' : 'New case'}
          </Text>
        </Pressable>
      </View>
      <View style={styles.filterWrap}>
        <CasesFilterBar
          value={filter}
          onChange={setFilter}
          totalCount={rows.length}
          matchCount={visible.length}
        />
      </View>
      {visible.length === 0 ? (
        <View style={styles.emptyMatch}>
          <EmptyState
            icon="search"
            title="No cases match these filters"
            description={
              filterActive
                ? 'Try clearing the filters above or searching for something else.'
                : ''
            }
            action={
              filterActive ? (
                <Pressable
                  onPress={() => setFilter(emptyCaseFilter())}
                  style={({ pressed }) => [
                    styles.clearAction,
                    { opacity: pressed ? 0.88 : 1 },
                  ]}
                >
                  <Feather name="x" size={12} color={colors.primary} />
                  <Text style={styles.clearActionText}>Clear filters</Text>
                </Pressable>
              ) : null
            }
          />
        </View>
      ) : (
        <FlatList
          data={visible}
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
      )}

      <AddCaseModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(created) => {
          setAddOpen(false);
          if (created && created.id) {
            load();
            navigation.navigate('CaseDetail', { caseId: created.id });
          } else {
            load();
          }
        }}
      />
    </ScreenContainer>
  );
}

function QuotaBanner({ usage, planName }) {
  if (!usage) return null;
  const isFull = !usage.unlimited && (usage.remaining || 0) <= 0;
  return (
    <View style={[styles.quotaBanner, isFull ? styles.quotaBannerFull : null]}>
      <Feather
        name={isFull ? 'alert-circle' : 'briefcase'}
        size={12}
        color={isFull ? '#b91c1c' : colors.primary}
      />
      <Text style={[styles.quotaBannerText, isFull ? styles.quotaBannerTextFull : null]}>
        {usage.unlimited
          ? `Unlimited cases on the ${planName || 'current'} plan.`
          : isFull
            ? `Plan limit reached on ${planName || 'your plan'} (${usage.used}/${usage.limit}). Upgrade to add more.`
            : `${usage.used}/${usage.limit} cases used on the ${planName || 'current'} plan.`}
      </Text>
    </View>
  );
}

function CaseRow({ item }) {
  const assignees = Array.isArray(item.professionalIds)
    ? item.professionalIds.filter(Boolean)
    : [];
  const isFirmCase = assignees.length >= 2;
  const priority = item.priority || 'medium';
  const stageLabel = item.stage ? STAGE_LABEL[item.stage] || item.stage : null;
  const clientName =
    (item.client && item.client.name) || item.clientName || item.clientId;
  const clientPhone = item.client && item.client.phone;

  return (
    <Card style={{ marginBottom: spacing.sm }}>
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
          {stageLabel ? (
            <Badge variant="blue">{stageLabel}</Badge>
          ) : (
            <Badge variant="gray">Stage —</Badge>
          )}
          <Badge variant={PRIORITY_VARIANT[priority] || 'gray'}>
            {priority}
          </Badge>
        </View>
      </View>

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerStripEmpty: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerLeft: { flex: 1, gap: 2 },
  count: { fontSize: fontSize.sm, color: colors.textSecondary },
  quotaPill: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
  },
  newCaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  newCaseText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  quotaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  quotaBannerFull: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  quotaBannerText: {
    flex: 1,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  quotaBannerTextFull: { color: '#b91c1c' },
  filterWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  listContent: { padding: spacing.lg, paddingTop: 0 },
  emptyMatch: { paddingVertical: spacing.xl },
  clearAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  clearActionText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },

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
