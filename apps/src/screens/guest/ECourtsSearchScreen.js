// ECourtsSearchScreen — mobile mirror of the web /ecourts page.
// Hero with brand tagline + form (query + 5 narrow filters) + paginated
// results list. Cards link to ECourtsCaseDetail. Search itself is
// public; the detail screen gates on auth.

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AuthInput from '../../components/auth/AuthInput';
import EmptyState from '../../components/common/EmptyState';
import {
  getCaseByCnr,
  looksLikeCnr,
  refreshAsAdd,
  searchCases,
} from '../../services/ecourtsService';
import { useAuth } from '../../contexts/AuthContext';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const PAGE_SIZE = 12;

const FILTERS = [
  { key: 'advocates', label: 'Advocate', icon: 'briefcase', placeholder: 'e.g. Harish Salve' },
  { key: 'judges', label: 'Judge', icon: 'shield', placeholder: 'e.g. D.Y. Chandrachud' },
  { key: 'petitioners', label: 'Petitioner', icon: 'user-check', placeholder: 'Name' },
  { key: 'respondents', label: 'Respondent', icon: 'users', placeholder: 'Name' },
  { key: 'litigants', label: 'Litigant (either side)', icon: 'shield', placeholder: 'Petitioner OR respondent' },
];

const EMPTY = {
  query: '',
  advocates: '',
  judges: '',
  petitioners: '',
  respondents: '',
  litigants: '',
};

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

function StatusBadge({ status }) {
  const s = String(status || '').toUpperCase();
  const isDisposed = s.includes('DISPOSED');
  return (
    <View
      style={[
        styles.badge,
        isDisposed ? styles.badgeDisposed : styles.badgePending,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          isDisposed ? styles.badgeTextDisposed : styles.badgeTextPending,
        ]}
        numberOfLines={1}
      >
        {status || 'Unknown'}
      </Text>
    </View>
  );
}

function ResultCard({ item, onPress }) {
  const petitioner =
    (Array.isArray(item.petitioners) && item.petitioners[0]) || '';
  const respondent =
    (Array.isArray(item.respondents) && item.respondents[0]) || '';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cnr} numberOfLines={1}>
            {item.cnr}
          </Text>
          <Text style={styles.title} numberOfLines={2}>
            {petitioner || item.cnr || 'Untitled case'}
            {respondent ? (
              <Text style={styles.titleVs}> vs {respondent}</Text>
            ) : null}
          </Text>
        </View>
        <StatusBadge status={item.caseStatus} />
      </View>

      <View style={styles.metaRow}>
        {item.caseType ? (
          <MetaChip icon="file-text" label={item.caseType} />
        ) : null}
        {item.courtCode ? (
          <MetaChip icon="map-pin" label={item.courtCode} />
        ) : null}
        {item.filingDate ? (
          <MetaChip icon="calendar" label={formatDate(item.filingDate)} />
        ) : null}
        {item.nextHearingDate ? (
          <MetaChip
            icon="clock"
            label={`Next: ${formatDate(item.nextHearingDate)}`}
            tone="amber"
          />
        ) : null}
      </View>

      <View style={styles.cardCta}>
        <Text style={styles.cardCtaText}>View case detail</Text>
        <Feather name="arrow-right" size={13} color={colors.primary} />
      </View>
    </Pressable>
  );
}

function MetaChip({ icon, label, tone }) {
  const isAmber = tone === 'amber';
  return (
    <View
      style={[
        styles.metaChip,
        isAmber && { backgroundColor: 'rgba(217,119,6,0.1)' },
      ]}
    >
      <Feather
        name={icon}
        size={11}
        color={isAmber ? colors.primary : colors.textMuted}
      />
      <Text
        style={[
          styles.metaText,
          isAmber && { color: colors.primarySoftText },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export default function ECourtsSearchScreen({ navigation }) {
  const { user, isGuest, exitGuest } = useAuth();
  const isAuthed = !!user && !isGuest;
  const [filters, setFilters] = useState(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const [page, setPage] = useState(1);
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState({ totalHits: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  // Refresh-as-add state. Backend kicks the upstream rescrape and we
  // poll /case/:cnr from here every 15s until the case lands. The
  // partner API quotes 5–10 minutes for unknown CNRs.
  const [fetchingFromSource, setFetchingFromSource] = useState(false);
  const [fetchInfo, setFetchInfo] = useState(null); // { eta, elapsedS }
  const [refreshHint, setRefreshHint] = useState('');
  const requestIdRef = useRef(0);
  const fetchAbortRef = useRef(null);

  const activeCount = useMemo(
    () =>
      Object.values(filters).reduce(
        (n, v) => (String(v || '').trim() ? n + 1 : n),
        0
      ),
    [filters]
  );

  const update = (patch) => setFilters((prev) => ({ ...prev, ...patch }));
  const reset = () => {
    setFilters(EMPTY);
    setResults([]);
    setMeta({ totalHits: 0, totalPages: 0 });
    setSearchedOnce(false);
    setError('');
    setPage(1);
  };

  const runSearch = useCallback(
    async (targetPage, append) => {
      if (activeCount === 0) {
        setError('Enter at least one search term to look up a case.');
        return;
      }
      const myReq = ++requestIdRef.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError('');
      setRefreshHint('');
      try {
        const payload = await searchCases({
          ...filters,
          page: targetPage,
          pageSize: PAGE_SIZE,
        });
        if (requestIdRef.current !== myReq) return;
        const rows = (payload && payload.results) || [];
        setResults((prev) => (append ? [...prev, ...rows] : rows));
        setMeta({
          totalHits: payload?.totalHits ?? rows.length,
          totalPages: payload?.totalPages ?? 1,
          hasNextPage: !!payload?.hasNextPage,
        });
        setPage(targetPage);
        setSearchedOnce(true);

        // Refresh-as-add fallback — see web /ecourts page for the same
        // logic. Partner search index lags behind the case-detail
        // endpoint and brand-new CNRs may be missing entirely. When
        // the user typed a CNR-shaped value and got 0 hits, ask the
        // backend to trigger an upstream rescrape, then jump straight
        // to the detail screen.
        // Fire refresh-as-add whenever the main query box holds a
        // CNR-shaped value — even with narrow filters set. Pagination
        // should never re-kick the rescrape.
        const q = String(filters.query || '').trim();
        const cnrShaped = looksLikeCnr(q) && targetPage === 1 && !append;
        if (rows.length === 0 && cnrShaped) {
          if (!isAuthed) {
            setRefreshHint(
              'Looks like a CNR. Sign in to fetch this case directly from the source.'
            );
            return;
          }
          setLoading(false);
          setFetchingFromSource(true);
          setFetchInfo({ eta: '5–10 minutes', elapsedS: 0 });

          if (fetchAbortRef.current) fetchAbortRef.current.cancelled = true;
          const ctrl = { cancelled: false };
          fetchAbortRef.current = ctrl;

          try {
            const kicked = await refreshAsAdd(q);
            if (requestIdRef.current !== myReq || ctrl.cancelled) return;
            if (kicked && kicked.ready && kicked.case) {
              navigation.navigate('ECourtsCaseDetail', { cnr: q });
              return;
            }
            const queueEta =
              (kicked && kicked.queue && kicked.queue.estimatedTime) ||
              '5–10 minutes';
            setFetchInfo({ eta: String(queueEta), elapsedS: 0 });

            // Browser-side poll — 15s interval, 2-minute ceiling so
            // the user gets a clear "check back later" hint instead
            // of an endless spinner.
            const POLL_INTERVAL_MS = 15000;
            const MAX_WAIT_MS = 2 * 60 * 1000;
            const start = Date.now();
            const tickHandle = setInterval(() => {
              if (ctrl.cancelled) return;
              setFetchInfo((prev) =>
                prev
                  ? { ...prev, elapsedS: Math.floor((Date.now() - start) / 1000) }
                  : prev
              );
            }, 1000);

            try {
              while (
                !ctrl.cancelled &&
                Date.now() - start < MAX_WAIT_MS
              ) {
                await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
                if (ctrl.cancelled || requestIdRef.current !== myReq) return;
                try {
                  const data = await getCaseByCnr(q);
                  if (ctrl.cancelled) return;
                  if (data && data.courtCaseData) {
                    navigation.navigate('ECourtsCaseDetail', { cnr: q });
                    return;
                  }
                } catch (pollErr) {
                  // 404 → still settling. Other errors bubble up.
                  if (
                    pollErr &&
                    pollErr.statusCode !== 404 &&
                    pollErr.status !== 404
                  ) {
                    throw pollErr;
                  }
                }
              }
              if (!ctrl.cancelled) {
                setRefreshHint(
                  "E-Courts is still fetching this CNR. Check back in a few minutes — the case will be ready by then."
                );
              }
            } finally {
              clearInterval(tickHandle);
            }
          } catch (refreshErr) {
            if (requestIdRef.current !== myReq || ctrl.cancelled) return;
            const msg =
              typeof refreshErr?.message === 'string'
                ? refreshErr.message
                : 'Could not fetch this CNR from source. Try again later.';
            setRefreshHint(msg);
          } finally {
            if (requestIdRef.current === myReq && !ctrl.cancelled) {
              setFetchingFromSource(false);
              setFetchInfo(null);
            }
          }
        }
      } catch (err) {
        if (requestIdRef.current !== myReq) return;
        setError(err.message || 'Search failed. Please try again.');
        if (!append) {
          setResults([]);
          setMeta({ totalHits: 0, totalPages: 0 });
        }
      } finally {
        if (requestIdRef.current === myReq) {
          if (append) setLoadingMore(false);
          else setLoading(false);
        }
      }
    },
    [filters, activeCount, isAuthed, navigation]
  );

  function onEndReached() {
    if (loading || loadingMore) return;
    if (!meta.hasNextPage) return;
    runSearch(page + 1, true);
  }

  function openDetail(cnr) {
    navigation.navigate('ECourtsCaseDetail', { cnr });
  }

  const ListHeader = (
    <View>
      {/* Hero */}
      <LinearGradient
        colors={['#0b1220', '#0f172a', '#1e293b']}
        style={styles.hero}
      >
        <View style={styles.heroTag}>
          <Feather name="award" size={11} color="#fbbf24" />
          <Text style={styles.heroTagText}>Look up any Indian court case</Text>
        </View>
        <Text style={styles.heroSub}>
          Search the Supreme Court, all High Courts and 1000+ District Courts
          by CNR, party name, advocate or judge.
        </Text>

        {/* Cause-list shortcut — the other primary partner-API
            capability, surfaced here so visitors who land on the
            search hero see it without scrolling. */}
        <Pressable
          onPress={() => navigation.navigate('ECourtsHearings')}
          style={({ pressed }) => [
            styles.causelistPill,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="calendar" size={12} color="#fbbf24" />
          <Text style={styles.causelistText}>
            Daily cause list — find when you’re listed
          </Text>
          <Feather name="arrow-right" size={12} color="#fbbf24" />
        </Pressable>
      </LinearGradient>

      {/* Search form */}
      <View style={styles.form}>
        <Text style={styles.label}>Search anywhere</Text>
        <AuthInput
          icon="search"
          placeholder="CNR number, case title, party name, keyword…"
          value={filters.query}
          onChangeText={(v) => update({ query: v })}
        />
        <Text style={styles.hint}>
          Full-text search across CNR, parties, advocates, judges, case type.
        </Text>

        <Pressable
          onPress={() => setShowFilters((v) => !v)}
          style={({ pressed }) => [
            styles.toggleFiltersBtn,
            { opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Feather
            name={showFilters ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.primary}
          />
          <Text style={styles.toggleFiltersText}>
            {showFilters ? 'Hide narrow filters' : 'Add narrow filters'}
          </Text>
          {activeCount > 0 ? (
            <View style={styles.activeCountPill}>
              <Text style={styles.activeCountText}>{activeCount}</Text>
            </View>
          ) : null}
        </Pressable>

        {showFilters ? (
          <View style={styles.filtersGrid}>
            {FILTERS.map(({ key, label, icon, placeholder }) => (
              <View key={key} style={styles.filterField}>
                <Text style={styles.filterLabel}>{label}</Text>
                <AuthInput
                  icon={icon}
                  placeholder={placeholder}
                  value={filters[key]}
                  onChangeText={(v) => update({ [key]: v })}
                />
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.formActions}>
          <Pressable
            onPress={reset}
            style={({ pressed }) => [
              styles.resetBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
          <Pressable
            onPress={() => runSearch(1, false)}
            disabled={loading || activeCount === 0}
            style={({ pressed }) => [
              styles.searchBtn,
              (loading || activeCount === 0) && { opacity: 0.55 },
              pressed && { opacity: 0.9 },
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
                <Feather name="search" size={14} color="#fff" />
              )}
              <Text style={styles.searchText}>
                {loading ? 'Searching…' : 'Search cases'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={13} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Results count header */}
        {searchedOnce && !loading ? (
          <Text style={styles.resultsCount}>
            <Text style={{ fontWeight: fontWeight.bold, color: colors.textPrimary }}>
              {Number(meta.totalHits || 0).toLocaleString('en-IN')}
            </Text>{' '}
            {meta.totalHits === 1 ? 'case' : 'cases'} found
          </Text>
        ) : null}
      </View>
    </View>
  );

  const ListFooter = loadingMore ? (
    <View style={styles.footerLoading}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.footerText}>Loading more…</Text>
    </View>
  ) : searchedOnce && results.length > 0 && !meta.hasNextPage ? (
    <Text style={styles.endPill}>YOU'VE REACHED THE END</Text>
  ) : null;

  const ListEmpty = loading ? (
    <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeleton} />
      ))}
    </View>
  ) : fetchingFromSource ? (
    <View style={styles.fetchingCard}>
      <ActivityIndicator size="small" color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.fetchingTitle}>
          Fetching this CNR from E-Courts…
        </Text>
        <Text style={styles.fetchingSub}>
          Queued a fresh scrape from the source court. Typical wait:{' '}
          <Text style={styles.fetchingEta}>
            {(fetchInfo && fetchInfo.eta) || '5–10 minutes'}
          </Text>
          .
        </Text>
        <Text style={styles.fetchingElapsed}>
          Elapsed{' '}
          {String(Math.floor((fetchInfo?.elapsedS || 0) / 60)).padStart(2, '0')}
          :
          {String((fetchInfo?.elapsedS || 0) % 60).padStart(2, '0')}{' '}
          · checking every 15s
        </Text>
      </View>
    </View>
  ) : refreshHint ? (
    <View style={styles.hintCard}>
      <Feather name="zap" size={20} color={colors.primary} />
      <Text style={styles.hintTitle}>That looks like a CNR</Text>
      <Text style={styles.hintSub}>{String(refreshHint)}</Text>
      <View style={styles.hintBtnRow}>
        <Pressable
          onPress={() => runSearch(1, false)}
          style={({ pressed }) => [
            styles.hintBtn,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="refresh-cw" size={12} color="#fff" />
          <Text style={styles.hintBtnText}>Try again</Text>
        </Pressable>
        {!isAuthed ? (
          <Pressable
            onPress={() => exitGuest?.()}
            style={({ pressed }) => [
              styles.hintGhost,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.hintGhostText}>Sign in</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  ) : searchedOnce ? (
    <EmptyState
      icon="search"
      title="No matching cases"
      description="Try a different name spelling, partial CNR, or remove filters."
    />
  ) : (
    <View style={styles.idlePanel}>
      <Feather name="award" size={24} color={colors.primary} />
      <Text style={styles.idleTitle}>Search any case in India</Text>
      <Text style={styles.idleSub}>
        Enter a CNR, party name or advocate above and hit Search.
      </Text>
    </View>
  );

  return (
    <FlatList
      data={loading ? [] : results}
      keyExtractor={(item, idx) => `${item.cnr}-${idx}`}
      keyboardShouldPersistTaps="handled"
      style={styles.root}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={ListEmpty}
      ListFooterComponent={ListFooter}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      renderItem={({ item }) => (
        <ResultCard item={item} onPress={() => openDetail(item.cnr)} />
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  listContent: { paddingBottom: spacing['2xl'], paddingHorizontal: spacing.lg },

  hero: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  brandPillText: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
    marginTop: 6,
    color: '#cbd5e1',
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
  },

  // Cause-list shortcut pill on the dark hero. Stays brand-amber so
  // the secondary action still reads as a Profirmo CTA against the
  // slate-950 backdrop.
  causelistPill: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  causelistText: {
    color: '#fbbf24',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },

  form: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  hint: { marginTop: 6, fontSize: 11, color: colors.textMuted, lineHeight: 15 },

  toggleFiltersBtn: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  toggleFiltersText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.primarySoftText,
  },
  activeCountPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  activeCountText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },

  filtersGrid: { marginTop: spacing.sm, gap: spacing.sm },
  filterField: {},
  filterLabel: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: 4,
  },

  formActions: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  resetBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  resetText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
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

  idlePanel: {
    marginTop: spacing.md,
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
    maxWidth: 280,
    lineHeight: 17,
  },
  skeleton: {
    height: 110,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },

  // Shown while we wait for /refresh-as-add to settle. Lives in place
  // of the empty-results card so the page doesn't suddenly look idle.
  fetchingCard: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.3)',
    backgroundColor: 'rgba(217,119,6,0.08)',
  },
  fetchingTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  fetchingSub: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  fetchingEta: {
    color: colors.textPrimary,
    fontWeight: fontWeight.bold,
  },
  fetchingElapsed: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.primarySoftText,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  // Shown when refresh-as-add couldn't fetch (timeout / not authed /
  // upstream error). Offers Try again + Sign in CTAs.
  hintCard: {
    marginTop: spacing.md,
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
  },
  hintTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  hintSub: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 17,
  },
  hintBtnRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  hintBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
  },
  hintBtnText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: '#fff',
  },
  hintGhost: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hintGhostText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
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
  titleVs: { fontWeight: fontWeight.semibold, color: colors.textSecondary },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: 110,
  },
  badgePending: {
    backgroundColor: 'rgba(217,119,6,0.1)',
    borderColor: 'rgba(217,119,6,0.3)',
    borderWidth: 1,
  },
  badgeDisposed: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(16,185,129,0.3)',
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  badgeTextPending: { color: colors.primarySoftText },
  badgeTextDisposed: { color: colors.success },

  metaRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  metaText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },

  cardCta: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardCtaText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },

  footerLoading: {
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
  endPill: {
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
});
