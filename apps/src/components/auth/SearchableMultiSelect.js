// SearchableMultiSelect — multi-select dropdown. Trigger shows pills
// for each selected option (with an X to clear); tapping opens a
// search modal where rows can be toggled on/off.

import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function SearchableMultiSelect({
  label,
  hint,
  icon = 'tag',
  options = [],
  value = [],
  onChange,
  placeholder = 'Select…',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const selectedSet = useMemo(() => new Set(value), [value]);
  const selectedItems = useMemo(
    () => options.filter((o) => selectedSet.has(o.value)),
    [options, selectedSet]
  );

  function toggle(v) {
    if (selectedSet.has(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  }

  function remove(v) {
    onChange(value.filter((x) => x !== v));
  }

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            opacity: pressed && !disabled ? 0.95 : 1,
            backgroundColor: disabled ? colors.surfaceMuted : colors.surface,
            borderColor: open ? colors.primary : colors.borderStrong,
          },
        ]}
      >
        <Feather
          name={icon}
          size={16}
          color={colors.textMuted}
          style={{ marginRight: 8 }}
        />
        {selectedItems.length === 0 ? (
          <Text style={[styles.triggerText, { color: colors.textMuted }]}>
            {placeholder}
          </Text>
        ) : (
          <View style={styles.chipRow}>
            {selectedItems.slice(0, 4).map((item) => (
              <View key={item.value} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {item.label}
                </Text>
                <Pressable onPress={() => remove(item.value)} hitSlop={6}>
                  <Feather name="x" size={11} color={colors.primarySoftText} />
                </Pressable>
              </View>
            ))}
            {selectedItems.length > 4 ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  +{selectedItems.length - 4} more
                </Text>
              </View>
            ) : null}
          </View>
        )}
        <Feather name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <PickerModal
        open={open}
        title={label || 'Select'}
        options={options}
        selectedSet={selectedSet}
        onToggle={toggle}
        onClose={() => setOpen(false)}
        onClear={() => onChange([])}
      />
    </View>
  );
}

function PickerModal({ open, title, options, selectedSet, onToggle, onClose, onClear }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.sheet} edges={['top', 'left', 'right']}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {selectedSet.size > 0 ? (
              <Pressable onPress={onClear} hitSlop={6}>
                <Text style={styles.clearText}>Clear all</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search…"
            placeholderTextColor={colors.textMuted}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Feather name="x-circle" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No matches for "{query}"</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            renderItem={({ item }) => {
              const active = selectedSet.has(item.value);
              return (
                <Pressable
                  onPress={() => onToggle(item.value)}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  <View
                    style={[
                      styles.tick,
                      active && {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    {active ? (
                      <Feather name="check" size={12} color={colors.textInverse} />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.rowText,
                      active && { color: colors.primary, fontWeight: fontWeight.bold },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textPrimary, marginBottom: 6 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 46,
  },
  triggerText: { flex: 1, fontSize: fontSize.base, color: colors.textPrimary },
  chipRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  chipText: { fontSize: 11, fontWeight: fontWeight.bold, color: colors.primarySoftText, maxWidth: 110 },
  hint: { marginTop: 4, fontSize: fontSize.xs, color: colors.textMuted },

  sheet: { flex: 1, backgroundColor: colors.bg },
  sheetHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  sheetTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  doneText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  clearText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  searchBar: {
    margin: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: fontSize.base, color: colors.textPrimary },
  empty: { padding: spacing.lg, alignItems: 'center' },
  emptyText: { color: colors.textMuted },
  sep: { height: 1, backgroundColor: colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  rowText: { fontSize: fontSize.base, color: colors.textPrimary, flex: 1 },
  tick: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
});
