// CaseStageTracker — dropdown-style stage selector. Tapping the
// trigger opens a sheet listing every stage from /api/cases/stages so
// the pro can move the case to any point in the workflow. Optimistic
// PATCH with rollback on failure mirrors the web tracker.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Card from '../common/Card';
import {
  listCaseStages,
  updateCaseStage,
} from '../../services/caseService';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function CaseStageTracker({ caseRow, onUpdated, readOnly = false }) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [stage, setStage] = useState(caseRow ? caseRow.stage || '' : '');
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setStage(caseRow ? caseRow.stage || '' : '');
  }, [caseRow]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listCaseStages();
      setStages(rows);
    } catch (err) {
      setError((err && err.message) || 'Could not load stage list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stageIndex = useMemo(() => {
    if (!stage) return -1;
    return stages.findIndex((s) => s.key === stage);
  }, [stages, stage]);

  const current = stage ? stages.find((s) => s.key === stage) : null;

  async function pick(next) {
    setPickerOpen(false);
    if (!caseRow || !next || next.key === stage || saving) return;
    const previous = stage;
    setStage(next.key);
    setSaving(true);
    setError('');
    try {
      const updated = await updateCaseStage(caseRow.id, next.key);
      if (typeof onUpdated === 'function') onUpdated(updated);
    } catch (err) {
      setStage(previous);
      setError((err && err.message) || 'Could not update stage.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <Feather name="git-branch" size={13} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Case stage</Text>
          <Text style={styles.headerSub}>
            {current
              ? `Currently in ${current.label}.`
              : readOnly
                ? 'No stage set yet.'
                : 'Pick a stage to set where this case stands.'}
          </Text>
        </View>
        {saving ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={11} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => !loading && !readOnly && setPickerOpen(true)}
        disabled={loading || saving || readOnly}
        style={({ pressed }) => [
          styles.trigger,
          {
            opacity:
              loading || saving ? 0.6 : pressed && !readOnly ? 0.94 : 1,
          },
        ]}
      >
        <View style={styles.triggerLeft}>
          {loading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <View style={styles.stagePill}>
              <Text style={styles.stagePillText} numberOfLines={1}>
                {current ? current.label : readOnly ? 'Not set' : 'Set stage'}
              </Text>
            </View>
          )}
          {!loading && stageIndex >= 0 ? (
            <Text style={styles.triggerPosition}>
              Step {stageIndex + 1} of {stages.length}
            </Text>
          ) : null}
        </View>
        {!readOnly ? (
          <Feather name="chevron-down" size={14} color={colors.textSecondary} />
        ) : null}
      </Pressable>

      <Modal
        visible={pickerOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setPickerOpen(false)}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation?.()}>
            <Text style={styles.sheetTitle}>Set stage</Text>
            <Text style={styles.sheetSub}>
              Move the case to any point in the workflow.
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {stages.map((s, i) => {
                const isCurrent = s.key === stage;
                const isPast = stageIndex >= 0 && i < stageIndex;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => pick(s)}
                    style={({ pressed }) => [
                      styles.row,
                      isCurrent ? styles.rowCurrent : null,
                      { opacity: pressed ? 0.92 : 1 },
                    ]}
                  >
                    <View
                      style={[
                        styles.rowMarker,
                        isCurrent ? styles.rowMarkerCurrent : null,
                        isPast && !isCurrent ? styles.rowMarkerPast : null,
                      ]}
                    >
                      {isPast && !isCurrent ? (
                        <Feather name="check" size={10} color="#ffffff" />
                      ) : (
                        <Text
                          style={[
                            styles.rowMarkerText,
                            isCurrent ? styles.rowMarkerTextCurrent : null,
                          ]}
                        >
                          {i + 1}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.rowLabel,
                          isCurrent ? styles.rowLabelCurrent : null,
                        ]}
                        numberOfLines={1}
                      >
                        {s.label}
                      </Text>
                      {s.description ? (
                        <Text style={styles.rowDesc} numberOfLines={2}>
                          {s.description}
                        </Text>
                      ) : null}
                    </View>
                    {isCurrent ? (
                      <Feather
                        name="check"
                        size={14}
                        color={colors.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              onPress={() => setPickerOpen(false)}
              style={({ pressed }) => [
                styles.closeBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.closeBtnText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  headerSub: { marginTop: 1, fontSize: 11, color: colors.textMuted },

  errorBox: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.md,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorText: { flex: 1, fontSize: 11, color: '#b91c1c' },

  trigger: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  triggerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stagePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: '#4f46e5',
    maxWidth: '70%',
  },
  stagePillText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  triggerPosition: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
  },
  sheetTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  sheetSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 11,
    borderRadius: radius.md,
  },
  rowCurrent: { backgroundColor: colors.primarySoft },
  rowMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMarkerCurrent: { backgroundColor: '#4f46e5' },
  rowMarkerPast: { backgroundColor: '#10b981' },
  rowMarkerText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  rowMarkerTextCurrent: { color: '#ffffff' },
  rowLabel: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: fontWeight.semibold,
  },
  rowLabelCurrent: { color: colors.primary },
  rowDesc: { marginTop: 1, fontSize: 11, color: colors.textMuted },

  closeBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
});
