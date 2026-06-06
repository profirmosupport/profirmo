// ECourtsHearingsScreen — daily cause-list lookup for the mobile app.
// Mirrors /ecourts/hearings on web. Form drives /api/ecourts/causelist/search.
// Causelist hits are credit-billed upstream, so we lazy-fire: nothing
// runs until the user taps Search.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AuthInput from '../../components/auth/AuthInput';
import EmptyState from '../../components/common/EmptyState';
import { searchCauselist } from '../../services/ecourtsService';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const PAGE_SIZE = 20;

function isoToday(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      weekday: 'short',
    });
  } catch {
    return String(iso);
  }
}

function HearingCard({ entry, onOpen }) {
  const cnr = entry.cnr || entry.cnrNumber;
  const title =
    entry.caseTitle ||
    entry.title ||
    [entry.petitioner, entry.respondent].filter(Boolean).join(' vs ') ||
    cnr ||
    'Untitled hearing';
  return (
    <Pressable
      onPress={() => cnr && onOpen(cnr)}
      style={({ pressed }) => [
        styles.card,
        { opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          {cnr ? (
            <Text style={styles.cnr} numberOfLines={1}>
              {cnr}
            </Text>
          ) : null}
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        </View>
        {entry.listType ? (
          <View style={styles.typePill}>
            <Text style={styles.typePillText} numberOfLines={1}>
              {entry.listType}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Feather name="calendar" size={11} color={colors.primary} />
          <Text style={styles.metaPrimary}>
            {fmtDate(entry.hearingDate || entry.date)}
            {entry.serialNo ? `  ·  #${entry.serialNo}` : ''}
          </Text>
        </View>
        {entry.judge ? (
          <View style={styles.metaItem}>
            <Feather name="shield" size={10} color={colors.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {entry.judge}
            </Text>
          </View>
        ) : null}
        {entry.courtNo ? (
          <View style={styles.metaItem}>
            <Feather name="map-pin" size={10} color={colors.textMuted} />
            <Text style={styles.metaText}>Court {entry.courtNo}</Text>
          </View>
        ) : null}
      </View>

      {entry.purpose ? (
        <Text style={styles.purpose} numberOfLines={2}>
          {entry.purpose}
        </Text>
      ) : null}

      {cnr ? (
        <View style={styles.openHint}>
          <Text style={styles.openHintText}>Open case</Text>
          <Feather name="arrow-right" size={11} color={colors.primary} />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function ECourtsHearingsScreen({ navigation }) {
  const [filters, setFilters] = useState({
    advocate: '',
    judge: '',
    litigant: '',
    startDate: isoToday(0),
    endDate: isoToday(7),
  });
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState({ totalHits: 0, totalPages: 0, page: 1 });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [searchedOnce, setSearchedOnce] = useState(false);
  const requestIdRef = useRef(0);

  const activeCount = useMemo(
    () =>
      ['advocate', 'judge', 'litigant'].reduce(
        (n, k) => (String(filters[k] || '').trim() ? n + 1 : n),
        0
      ),
    [filters]
  );

  const update = (patch) => setFilters((prev) => ({ ...prev, ...patch }));

  const runSearch = useCallback(
    async (targetPage, append) => {
      const myReq = ++requestIdRef.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError('');
      try {
        const payload = await searchCauselist({
          advocate: filters.advocate || undefined,
          judge: filters.judge || undefined,
          litigant: filters.litigant || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          page: targetPage,
          pageSize: PAGE_SIZE,
        });
        if (requestIdRef.current !== myReq) return;
        const rows = (payload && payload.results) || [];
        setResults((prev) => (append ? [...prev, ...rows] : rows));
        setMeta({
          totalHits: payload?.totalHits ?? rows.length,
          totalPages: payload?.totalPages ?? 1,
          page: payload?.page ?? targetPage,
          hasNextPage: !!payload?.hasNextPage,
        });
        setSearchedOnce(true);
      } catch (err) {
        if (requestIdRef.current !== myReq) return;
        setError(err.message || 'Search failed. Please try again.');
        if (!append) {
          setResults([]);
          setMeta({ totalHits: 0, totalPages: 0, page: 1 });
        }
      } finally {
        if (requestIdRef.current === myReq) {
          if (append) setLoadingMore(false);
          else setLoading(false);
        }
      }
    },
    [filters]
  );

  function onEndReached() {
    if (loading || loadingMore || !meta.hasNextPage) return;
    runSearch(meta.page + 1, true);
  }

  const ListHeader = (
    <View>
      <LinearGradient
        colors={['#0b1220', '#0f172a', '#1e293b']}
        style={styles.hero}
      >
        <View style={styles.heroTag}>
          <Feather name="calendar" size={11} color="#fbbf24" />
          <Text style={styles.heroTagText}>Daily cause list</Text>
        </View>
        <Text style={styles.heroSub}>
          See when your matter is listed across every connected court in the
          next seven days.
        </Text>
      </LinearGradient>

      <View style={styles.form}>
        <Text style={styles.label}>Narrow by</Text>
        <AuthInput
          icon="briefcase"
          placeholder="Advocate name"
          value={filters.advocate}
          onChangeText={(v) => update({ advocate: v })}
        />
        <AuthInput
          icon="shield"
          placeholder="Presiding judge"
          value={filters.judge}
          onChangeText={(v) => update({ judge: v })}
        />
        <AuthInput
          icon="users"
          placeholder="Petitioner or respondent"
          value={filters.litigant}
          onChangeText={(v) => update({ litigant: v })}
        />

        <Text style={[styles.label, { marginTop: spacing.sm }]}>
          Date window
        </Text>
        <View style={styles.dateRow}>
          <DateField
            label="From"
            value={filters.startDate}
            onChange={(v) => update({ startDate: v })}
          />
          <DateField
            label="To"
            value={filters.endDate}
            onChange={(v) => update({ endDate: v })}
          />
        </View>

        <View style={styles.actions}>
          <Text style={styles.activePill}>
            {activeCount > 0
              ? `${activeCount} filter${activeCount === 1 ? '' : 's'} set`
              : 'No narrow filters'}
          </Text>
          <Pressable
            onPress={() => runSearch(1, false)}
            disabled={loading}
            style={({ pressed }) => [
              styles.searchBtn,
              (loading || pressed) && { opacity: 0.9 },
            ]}
          >
            <LinearGradient
              colors={['#f59e0b', '#d97706']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.searchFill}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="search" size={13} color="#fff" />
              )}
              <Text style={styles.searchText}>
                {loading ? 'Searching…' : 'Search hearings'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={12} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {searchedOnce && !loading ? (
          <Text style={styles.resultsCount}>
            <Text style={{ fontWeight: fontWeight.bold, color: colors.textPrimary }}>
              {Number(meta.totalHits || 0).toLocaleString('en-IN')}
            </Text>{' '}
            {meta.totalHits === 1 ? 'hearing' : 'hearings'} found
          </Text>
        ) : null}
      </View>
    </View>
  );

  const ListFooter = loadingMore ? (
    <View style={styles.footerLoad}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.footerText}>Loading more…</Text>
    </View>
  ) : null;

  const ListEmpty = loading ? (
    <View style={styles.skeletonStack}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeleton} />
      ))}
    </View>
  ) : searchedOnce ? (
    <EmptyState
      icon="calendar"
      title="No matching listings"
      description="Try a different date window or remove one of the filters."
    />
  ) : (
    <View style={styles.idleCard}>
      <Feather name="calendar" size={22} color={colors.primary} />
      <Text style={styles.idleTitle}>Pick a date range to begin</Text>
      <Text style={styles.idleSub}>
        Default is today through next week. Add a name above to narrow the
        list.
      </Text>
    </View>
  );

  return (
    <FlatList
      data={loading ? [] : results}
      keyExtractor={(item, idx) => `${item.cnr || item.id || 'e'}-${idx}`}
      keyboardShouldPersistTaps="handled"
      style={styles.root}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={ListEmpty}
      ListFooterComponent={ListFooter}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      renderItem={({ item }) => (
        <HearingCard
          entry={item}
          onOpen={(cnr) =>
            navigation.navigate('ECourtsCaseDetail', { cnr })
          }
        />
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
    />
  );
}

// DateField — minimal mobile date input. RN doesn't ship a date input,
// so we render a tappable pill that opens the system date picker via
// the lazy import below. Falls back to a plain text input on platforms
// where the picker isn't installed.
function DateField({ label, value, onChange }) {
  return (
    <View style={styles.dateField}>
      <Text style={styles.dateLabel}>{label}</Text>
      <AuthInput
        icon="calendar"
        placeholder="YYYY-MM-DD"
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['2xl'] },

  hero: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  heroTagText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroSub: {
    marginTop: 8,
    color: '#cbd5e1',
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
  },

  form: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  dateField: { flex: 1 },
  dateLabel: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: 4,
  },

  actions: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  activePill: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
  },
  searchBtn: { borderRadius: radius.md, overflow: 'hidden' },
  searchFill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#fff',
  },

  errorBox: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(220,38,38,0.08)',
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.danger,
    fontWeight: fontWeight.semibold,
  },

  resultsCount: {
    marginTop: spacing.md,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  skeletonStack: { gap: spacing.sm },
  skeleton: {
    height: 110,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  idleCard: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 8,
  },
  idleTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  idleSub: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 280,
  },

  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cnr: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 2,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(217,119,6,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.3)',
    maxWidth: 120,
  },
  typePillText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: colors.primarySoftText,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  metaRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaPrimary: {
    fontSize: fontSize.xs,
    color: colors.textPrimary,
    fontWeight: fontWeight.semibold,
  },
  metaText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
  purpose: {
    marginTop: 6,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  openHint: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  openHintText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },

  footerLoad: {
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
});
