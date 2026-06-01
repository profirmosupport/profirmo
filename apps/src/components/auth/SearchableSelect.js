// SearchableSelect — labeled trigger that opens a full-screen modal
// with a search box + filtered options list. Used for Country, State
// and City dropdowns where the option set is too large to scroll.
//
// Props:
//   label          field label shown above the trigger
//   icon           Feather icon prefix
//   options        [{ value, label }]
//   value          currently selected value (string)
//   onChange(v)    fires on selection
//   placeholder    shown when nothing selected
//   disabled       when true, the trigger is non-interactive + greyed
//   error          inline error message under the trigger

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

export default function SearchableSelect({
  label,
  icon,
  options = [],
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  error,
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            borderColor: error
              ? colors.danger
              : open
                ? colors.primary
                : colors.borderStrong,
            backgroundColor: disabled ? colors.surfaceMuted : colors.surface,
            opacity: pressed && !disabled ? 0.95 : 1,
          },
        ]}
      >
        {icon ? (
          <Feather
            name={icon}
            size={16}
            color={colors.textMuted}
            style={styles.iconPrefix}
          />
        ) : null}
        <Text
          style={[
            styles.triggerText,
            !selected && { color: colors.textMuted },
          ]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Feather name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PickerModal
        open={open}
        title={label || 'Select'}
        options={options}
        value={value}
        onClose={() => setOpen(false)}
        onSelect={(v) => {
          onChange(v);
          setOpen(false);
        }}
      />
    </View>
  );
}

function PickerModal({ open, title, options, value, onClose, onSelect }) {
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
          <Pressable onPress={onClose} hitSlop={8}>
            <Feather name="x" size={20} color={colors.textSecondary} />
          </Pressable>
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
              const active = item.value === value;
              return (
                <Pressable
                  onPress={() => onSelect(item.value)}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  <Text
                    style={[
                      styles.rowText,
                      active && { color: colors.primary, fontWeight: fontWeight.bold },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {active ? (
                    <Feather name="check" size={16} color={colors.primary} />
                  ) : null}
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
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  iconPrefix: { marginRight: 8 },
  triggerText: { flex: 1, fontSize: fontSize.base, color: colors.textPrimary },
  error: { marginTop: 4, fontSize: fontSize.xs, color: colors.danger },

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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  rowText: { fontSize: fontSize.base, color: colors.textPrimary },
});
