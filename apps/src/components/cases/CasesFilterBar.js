// CasesFilterBar — mobile mirror of the web's shared search + filter
// row mounted above the cases list. Same client-side filter shape so
// applyCaseFilters() from utils/caseFilters.js works identically on
// both surfaces.

import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  STAGE_ORDER,
  STAGE_LABEL,
  PRIORITY_OPTIONS,
  emptyCaseFilter,
  isCaseFilterActive,
} from '../../utils/caseFilters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function CasesFilterBar({
  value,
  onChange,
  totalCount,
  matchCount,
}) {
  const filter = value || emptyCaseFilter();
  const active = isCaseFilterActive(filter);
  const [stageOpen, setStageOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);

  function patch(part) {
    onChange({ ...filter, ...part });
  }

  const stageLabel = filter.stage
    ? filter.stage === '__unassigned'
      ? 'Not set'
      : STAGE_LABEL[filter.stage] || filter.stage
    : 'All stages';
  const priorityLabel = filter.priority
    ? PRIORITY_OPTIONS.find((p) => p.value === filter.priority)?.label ||
      filter.priority
    : 'All priorities';

  return (
    <View style={styles.wrap}>
      <View style={styles.searchRow}>
        <Feather
          name="search"
          size={14}
          color={colors.textMuted}
          style={styles.searchIcon}
        />
        <TextInput
          value={filter.q}
          onChangeText={(t) => patch({ q: t })}
          placeholder="Title, client, phone, CNR or court…"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {filter.q ? (
          <Pressable
            onPress={() => patch({ q: '' })}
            hitSlop={8}
            style={styles.clearBtn}
          >
            <Feather name="x" size={12} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chipRow}>
        <Pressable
          onPress={() => setStageOpen(true)}
          style={({ pressed }) => [
            styles.chip,
            filter.stage ? styles.chipActive : null,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text
            style={[
              styles.chipText,
              filter.stage ? styles.chipTextActive : null,
            ]}
            numberOfLines={1}
          >
            Stage: {stageLabel}
          </Text>
          <Feather
            name="chevron-down"
            size={12}
            color={filter.stage ? colors.primary : colors.textMuted}
          />
        </Pressable>

        <Pressable
          onPress={() => setPriorityOpen(true)}
          style={({ pressed }) => [
            styles.chip,
            filter.priority ? styles.chipActive : null,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text
            style={[
              styles.chipText,
              filter.priority ? styles.chipTextActive : null,
            ]}
            numberOfLines={1}
          >
            Priority: {priorityLabel}
          </Text>
          <Feather
            name="chevron-down"
            size={12}
            color={filter.priority ? colors.primary : colors.textMuted}
          />
        </Pressable>

        {active ? (
          <Pressable
            onPress={() => onChange(emptyCaseFilter())}
            style={({ pressed }) => [
              styles.clearAllBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Feather name="x" size={11} color={colors.textSecondary} />
            <Text style={styles.clearAllText}>Clear filters</Text>
          </Pressable>
        ) : null}
      </View>

      {active && typeof totalCount === 'number' ? (
        <Text style={styles.matchCount}>
          Showing <Text style={styles.matchCountBold}>{matchCount}</Text> of{' '}
          {totalCount} case{totalCount === 1 ? '' : 's'} matching your filters.
        </Text>
      ) : null}

      <PickerSheet
        open={stageOpen}
        title="Stage"
        options={[
          { value: '', label: 'All stages' },
          { value: '__unassigned', label: '— Not set —' },
          ...STAGE_ORDER.map((s) => ({ value: s, label: STAGE_LABEL[s] })),
        ]}
        selected={filter.stage}
        onSelect={(v) => {
          patch({ stage: v });
          setStageOpen(false);
        }}
        onClose={() => setStageOpen(false)}
      />
      <PickerSheet
        open={priorityOpen}
        title="Priority"
        options={[
          { value: '', label: 'All priorities' },
          ...PRIORITY_OPTIONS,
        ]}
        selected={filter.priority}
        onSelect={(v) => {
          patch({ priority: v });
          setPriorityOpen(false);
        }}
        onClose={() => setPriorityOpen(false)}
      />
    </View>
  );
}

function PickerSheet({ open, title, options, selected, onSelect, onClose }) {
  return (
    <Modal
      visible={open}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation?.()}>
          <Text style={styles.sheetTitle}>{title}</Text>
          {options.map((opt) => {
            const active = (selected || '') === (opt.value || '');
            return (
              <Pressable
                key={opt.value || '__empty'}
                onPress={() => onSelect(opt.value)}
                style={({ pressed }) => [
                  styles.sheetRow,
                  active ? styles.sheetRowActive : null,
                  { opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <Text
                  style={[
                    styles.sheetRowText,
                    active ? styles.sheetRowTextActive : null,
                  ]}
                >
                  {opt.label}
                </Text>
                {active ? (
                  <Feather name="check" size={14} color={colors.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  clearBtn: { padding: 4 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: '70%',
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  chipTextActive: { color: colors.primary },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  clearAllText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  matchCount: {
    fontSize: 11,
    color: colors.textMuted,
    paddingHorizontal: 2,
  },
  matchCountBold: { fontWeight: fontWeight.bold, color: colors.textPrimary },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
  },
  sheetTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 11,
    borderRadius: radius.md,
  },
  sheetRowActive: { backgroundColor: colors.primarySoft },
  sheetRowText: { fontSize: fontSize.sm, color: colors.textPrimary },
  sheetRowTextActive: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
});
