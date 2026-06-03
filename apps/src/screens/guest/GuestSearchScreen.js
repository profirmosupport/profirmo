// GuestSearchScreen — public catalog browser. The filter form lives
// as the FlatList header so it scrolls away as the user moves down
// the results. Pagination is driven by onEndReached — every
// additional page is appended to the list as the user scrolls.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import EmptyState from '../../components/common/EmptyState';
import {
  FirmCardSkeleton,
  ProfessionalCardSkeleton,
} from '../../components/common/Skeleton';
import AuthInput from '../../components/auth/AuthInput';
import SearchableSelect from '../../components/auth/SearchableSelect';
import SearchableMultiSelect from '../../components/auth/SearchableMultiSelect';
import ProfessionalHorizontalCard from '../../components/guest/ProfessionalHorizontalCard';
import FirmCard from '../../components/guest/FirmCard';
import {
  listCategories,
  listLocations,
} from '../../services/appSettingsService';
import {
  listFirmsPublic,
  listProfessionals,
} from '../../services/professionalService';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const KIND = { PRO: 'pro', FIRM: 'firm' };
const PAGE_SIZE = 12;

export default function GuestSearchScreen({ navigation, route }) {
  const initialCategoryId =
    (route && route.params && route.params.categoryId) || '';

  const [kind, setKind] = useState(KIND.PRO);
  const [query, setQuery] = useState('');
  const [cityId, setCityId] = useState('');
  const [subCategoryIds, setSubCategoryIds] = useState(
    initialCategoryId ? [initialCategoryId] : []
  );

  const [countries, setCountries] = useState([]);
  const [categories, setCategories] = useState([]);

  // Paginated list state. `page` is what we just successfully loaded;
  // `hasMore` is computed from the response meta. `loadingMore` keeps
  // multiple end-reached events from kicking off duplicate fetches.
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Ref guards against the debounce timer firing AFTER a newer fetch
  // has started — only the latest request gets to write to state.
  const requestIdRef = useRef(0);

  useEffect(() => {
    listLocations().then(setCountries).catch(() => {});
    listCategories().then(setCategories).catch(() => {});
  }, []);

  const cityOptions = useMemo(() => {
    const out = [];
    for (const c of countries) {
      for (const s of c.states || []) {
        for (const city of s.cities || []) {
          out.push({ value: city.id, label: `${city.name} — ${s.name}` });
        }
      }
    }
    return out;
  }, [countries]);

  const professionOptions = useMemo(() => {
    const out = [];
    for (const c of categories) {
      for (const s of c.subCategories || []) {
        out.push({
          value: s.id,
          label: `${s.name} — ${c.name}`,
          parent: c.name,
        });
      }
    }
    return out;
  }, [categories]);

  // Fetch a specific page. When `append=false` we replace items;
  // otherwise we append. The shared `requestIdRef` discriminator
  // means a slow first-page request can never overwrite a fresher
  // result that arrived first.
  const fetchPage = useCallback(
    async (nextPage, append) => {
      const myRequest = ++requestIdRef.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const fetcher =
          kind === KIND.PRO
            ? () =>
                listProfessionals({
                  search: query.trim() || undefined,
                  city: cityId || undefined,
                  subCategoryIds: subCategoryIds.length
                    ? subCategoryIds
                    : undefined,
                  page: nextPage,
                  limit: PAGE_SIZE,
                })
            : () =>
                listFirmsPublic({
                  search: query.trim() || undefined,
                  city: cityId || undefined,
                  page: nextPage,
                  limit: PAGE_SIZE,
                });
        const res = await fetcher();
        if (requestIdRef.current !== myRequest) return;
        const incoming = (res && res.items) || [];
        const meta = (res && res.meta) || {};
        setItems((prev) => (append ? [...prev, ...incoming] : incoming));
        setPage(nextPage);
        const totalPages = Number(meta.totalPages);
        const knownTotal = Number.isFinite(totalPages) && totalPages > 0;
        setHasMore(
          knownTotal
            ? nextPage < totalPages
            : incoming.length === PAGE_SIZE
        );
      } catch {
        if (requestIdRef.current === myRequest && !append) setItems([]);
        setHasMore(false);
      } finally {
        if (requestIdRef.current === myRequest) {
          if (append) setLoadingMore(false);
          else setLoading(false);
        }
      }
    },
    [kind, query, cityId, subCategoryIds]
  );

  // Reset to page 1 whenever filters change. Debounce text input so
  // every keystroke doesn't fire a request.
  useEffect(() => {
    setHasMore(true);
    const t = setTimeout(() => {
      fetchPage(1, false);
    }, 300);
    return () => clearTimeout(t);
  }, [fetchPage]);

  // Apply the deep-link categoryId once on focus then wipe it from
  // route params so the user's subsequent clears stick.
  useFocusEffect(
    useCallback(() => {
      const incoming = route && route.params && route.params.categoryId;
      if (incoming) {
        setSubCategoryIds([incoming]);
        navigation.setParams({ categoryId: undefined });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [route])
  );

  function clearFilters() {
    setQuery('');
    setCityId('');
    setSubCategoryIds([]);
  }
  const activeFilters =
    (query.trim() ? 1 : 0) +
    (cityId ? 1 : 0) +
    (subCategoryIds.length > 0 ? 1 : 0);

  function onEndReached() {
    if (loading || loadingMore || !hasMore) return;
    fetchPage(page + 1, true);
  }

  const ListHeader = (
    <View style={styles.head}>
      <View style={styles.toggle}>
        <ToggleBtn
          label="Professionals"
          icon="user"
          active={kind === KIND.PRO}
          onPress={() => setKind(KIND.PRO)}
        />
        <ToggleBtn
          label="Firms"
          icon="briefcase"
          active={kind === KIND.FIRM}
          onPress={() => setKind(KIND.FIRM)}
        />
      </View>

      <AuthInput
        icon="search"
        placeholder="Search by name or expertise"
        value={query}
        onChangeText={setQuery}
      />

      <SearchableSelect
        icon="map-pin"
        placeholder="Any city"
        options={cityOptions}
        value={cityId}
        onChange={setCityId}
      />

      {kind === KIND.PRO ? (
        <SearchableMultiSelect
          icon="briefcase"
          placeholder="Any profession"
          options={professionOptions}
          value={subCategoryIds}
          onChange={setSubCategoryIds}
        />
      ) : null}

      {activeFilters > 0 ? (
        <Pressable onPress={clearFilters} style={styles.clearRow} hitSlop={6}>
          <Feather name="x" size={12} color={colors.danger} />
          <Text style={styles.clearText}>
            Clear filters · {activeFilters}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  const ListFooter = loadingMore ? (
    <View style={styles.footerLoading}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.footerLoadingText}>Loading more…</Text>
    </View>
  ) : !hasMore && items.length > 0 ? (
    <View style={styles.footerEnd}>
      <Text style={styles.footerEndText}>You've reached the end</Text>
    </View>
  ) : null;

  const ListEmpty = loading ? (
    <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
      {kind === KIND.PRO ? (
        <>
          <ProfessionalCardSkeleton width="100%" />
          <ProfessionalCardSkeleton width="100%" />
        </>
      ) : (
        <>
          <FirmCardSkeleton width="100%" />
          <FirmCardSkeleton width="100%" />
        </>
      )}
    </View>
  ) : (
    <EmptyState
      icon="search"
      title="Nothing matches"
      description="Try a different search or clear some filters."
    />
  );

  return (
    <FlatList
      data={loading ? [] : items}
      keyExtractor={(item, index) => `${item.id}-${index}`}
      keyboardShouldPersistTaps="handled"
      style={styles.list}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={ListEmpty}
      ListFooterComponent={ListFooter}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      renderItem={({ item }) =>
        kind === KIND.PRO ? (
          <ProfessionalHorizontalCard
            pro={item}
            width="100%"
            onPressProfile={() =>
              navigation.navigate('ProfessionalDetail', {
                professionalId: item.id,
              })
            }
            onPressBook={() =>
              navigation.navigate('Booking', { professionalId: item.id })
            }
          />
        ) : (
          <FirmCard
            firm={item}
            width="100%"
            onPress={() =>
              navigation.navigate('FirmDetail', { firmId: item.id })
            }
          />
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
    />
  );
}

function ToggleBtn({ label, icon, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggleBtn,
        active && styles.toggleBtnActive,
        { opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <Feather
        name={icon}
        size={13}
        color={active ? colors.textPrimary : colors.textSecondary}
      />
      <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  listContent: {
    paddingBottom: spacing['2xl'],
    paddingHorizontal: spacing.lg,
    flexGrow: 1,
  },
  head: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.md,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  toggleBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  toggleLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  toggleLabelActive: { color: colors.textPrimary },
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  clearText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.danger,
  },
  footerLoading: {
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerLoadingText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
  footerEnd: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  footerEndText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
