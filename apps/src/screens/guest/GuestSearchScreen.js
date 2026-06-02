// GuestSearchScreen — public catalog browser. Mirrors the web's
// advanced search: text query + searchable city and profession
// dropdowns + featured-category chips. Results render in a unified
// FlatList that toggles between Professionals and Firms via a top
// pill toggle.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { CardSkeleton } from '../../components/common/Skeleton';
import AuthInput from '../../components/auth/AuthInput';
import SearchableSelect from '../../components/auth/SearchableSelect';
import { listLocations, listCategories } from '../../services/appSettingsService';
import {
  listFirmsPublic,
  listProfessionals,
} from '../../services/professionalService';
import { formatRupees } from '../../utils/formatters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const KIND = { PRO: 'pro', FIRM: 'firm' };
const PRO_TYPES = [
  { value: 'Legal Consultant', label: 'Legal Consultant' },
  { value: 'Tax Consultant', label: 'Tax Consultant' },
];

export default function GuestSearchScreen({ navigation, route }) {
  // Allow deep-link from home: navigation.navigate('GuestSearch',{categoryId})
  const initialCategoryId = (route && route.params && route.params.categoryId) || '';

  const [kind, setKind] = useState(KIND.PRO);
  const [query, setQuery] = useState('');
  const [cityId, setCityId] = useState('');
  const [professionalType, setProfessionalType] = useState('');
  const [categoryId, setCategoryId] = useState(initialCategoryId);

  const [countries, setCountries] = useState([]);
  const [categories, setCategories] = useState([]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load static lookups once.
  useEffect(() => {
    listLocations().then(setCountries).catch(() => {});
    listCategories().then(setCategories).catch(() => {});
  }, []);

  // Flatten {country → state → city} to a single searchable list of
  // cities, labelled "Mumbai — Maharashtra".
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
  const cityName = useMemo(() => {
    for (const c of countries) {
      for (const s of c.states || []) {
        for (const city of s.cities || []) {
          if (city.id === cityId) return city.name;
        }
      }
    }
    return '';
  }, [countries, cityId]);

  // Category chip options — flatten sub-categories.
  const subOptions = useMemo(() => {
    const out = [];
    for (const c of categories) {
      for (const s of c.subCategories || []) {
        out.push({ id: s.id, name: s.name, parent: c.name });
      }
    }
    return out;
  }, [categories]);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      if (kind === KIND.PRO) {
        const res = await listProfessionals({
          search: query.trim() || undefined,
          city: cityName || undefined,
          professionalType: professionalType || undefined,
          category: categoryId || undefined,
        });
        setItems((res && res.items) || []);
      } else {
        const res = await listFirmsPublic({
          search: query.trim() || undefined,
          city: cityName || undefined,
        });
        setItems((res && res.items) || []);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [kind, query, cityName, professionalType, categoryId]);

  // Debounce query input. Reload on every other filter change.
  useEffect(() => {
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Re-run whenever the screen regains focus (e.g. user comes back
  // from a chip-driven navigate that mutated params).
  useFocusEffect(
    useCallback(() => {
      if (
        route &&
        route.params &&
        route.params.categoryId &&
        route.params.categoryId !== categoryId
      ) {
        setCategoryId(route.params.categoryId);
      }
    }, [categoryId, route])
  );

  function clearFilters() {
    setQuery('');
    setCityId('');
    setProfessionalType('');
    setCategoryId('');
  }
  const activeFilters =
    (query.trim() ? 1 : 0) +
    (cityId ? 1 : 0) +
    (professionalType ? 1 : 0) +
    (categoryId ? 1 : 0);

  return (
    <ScreenContainer scroll={false} contentStyle={{ padding: 0 }}>
      <View style={styles.head}>
        {/* Pro / Firm toggle */}
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

        <View style={styles.filterRow}>
          <View style={{ flex: 1 }}>
            <SearchableSelect
              icon="map-pin"
              placeholder="Any city"
              options={cityOptions}
              value={cityId}
              onChange={setCityId}
            />
          </View>
          {kind === KIND.PRO ? (
            <View style={{ flex: 1 }}>
              <SearchableSelect
                icon="briefcase"
                placeholder="Any profession"
                options={PRO_TYPES}
                value={professionalType}
                onChange={setProfessionalType}
              />
            </View>
          ) : null}
        </View>

        {/* Featured category chips — when a chip is selected, it's
            shown with the active style + a clear control. */}
        {subOptions.length > 0 ? (
          <View style={styles.chipScroller}>
            <FlatList
              data={subOptions}
              horizontal
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingRight: spacing.lg }}
              renderItem={({ item }) => {
                const active = item.id === categoryId;
                return (
                  <Pressable
                    onPress={() => setCategoryId(active ? '' : item.id)}
                    style={({ pressed }) => [
                      styles.featChip,
                      active && styles.featChipActive,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.featChipText,
                        active && styles.featChipTextActive,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
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

      {loading ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="search"
          title="Nothing matches"
          description="Try a different search or clear some filters."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing['2xl'],
            gap: spacing.sm,
          }}
          renderItem={({ item }) =>
            kind === KIND.PRO ? <ProRow item={item} /> : <FirmRow item={item} />
          }
        />
      )}
    </ScreenContainer>
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
      <Text
        style={[styles.toggleLabel, active && styles.toggleLabelActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ProRow({ item }) {
  return (
    <Card>
      <View style={styles.rowHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{item.name}</Text>
          {item.designation || item.professionalType ? (
            <Text style={styles.rowSubtitle}>
              {item.designation || item.professionalType}
            </Text>
          ) : null}
          <View style={styles.rowBadges}>
            {item.city ? <Badge variant="gray">{item.city}</Badge> : null}
            {item.rating ? <Badge variant="amber">★ {item.rating}</Badge> : null}
            {item.verified ? (
              <Badge variant="green">verified</Badge>
            ) : null}
          </View>
        </View>
        {item.consultationFee ? (
          <Text style={styles.rowFee}>{formatRupees(item.consultationFee)}</Text>
        ) : null}
      </View>
    </Card>
  );
}

function FirmRow({ item }) {
  return (
    <Card>
      <View style={styles.rowHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{item.name}</Text>
          {item.firmType ? (
            <Text style={styles.rowSubtitle}>{item.firmType}</Text>
          ) : null}
          <View style={styles.rowBadges}>
            {item.city ? <Badge variant="gray">{item.city}</Badge> : null}
            {item.numberOfProfessionals ? (
              <Badge variant="blue">{item.numberOfProfessionals} pros</Badge>
            ) : null}
            {item.rating ? <Badge variant="amber">★ {item.rating}</Badge> : null}
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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

  filterRow: { flexDirection: 'row', gap: spacing.sm },
  chipScroller: { marginTop: -4, marginBottom: 4, marginHorizontal: -spacing.lg, paddingLeft: spacing.lg },
  featChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  featChipText: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  featChipTextActive: { color: colors.primarySoftText },

  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  clearText: { fontSize: 11, fontWeight: fontWeight.semibold, color: colors.danger },

  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  rowBadges: { marginTop: 6, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  rowFee: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
});
