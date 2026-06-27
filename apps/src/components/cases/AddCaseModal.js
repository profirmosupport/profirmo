// AddCaseModal — mobile mirror of the web's case-creation form.
// Mirrors the website behaviour:
//   • title + category required
//   • multi-client picker pulls from /api/clients
//   • CNR lookup button → if E-Courts returns a match, the form
//     prefills from the upstream blob AND submit goes through
//     /api/ecourts/cases/import so the new row carries the full
//     eciSnapshot + source='ecourts' for future one-click sync
//   • plain /api/cases POST otherwise
//   • the calling professional auto-assigns themselves

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  createCase,
} from '../../services/caseService';
import { listClients } from '../../services/clientService';
import {
  getCaseByCnr,
  getImportedCase,
  importCaseFromEcourts,
} from '../../services/ecourtsService';
import { useAuth } from '../../contexts/AuthContext';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

function emptyForm() {
  return {
    clientIds: [],
    title: '',
    category: '',
    description: '',
    priority: 'medium',
    caseNumber: '',
    cnr: '',
    courtName: '',
    opposingParty: '',
    nextHearingDate: '',
  };
}

export default function AddCaseModal({ visible, onClose, onCreated }) {
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientQuery, setClientQuery] = useState('');

  // CNR lookup state.
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookup, setLookup] = useState(null);
  const [existingCase, setExistingCase] = useState({
    imported: false,
    caseId: null,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Date picker (next hearing).
  const [pickingDate, setPickingDate] = useState(false);
  const [draftDate, setDraftDate] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setForm(emptyForm());
    setLookup(null);
    setExistingCase({ imported: false, caseId: null });
    setLookupError('');
    setError('');
    setClientQuery('');
    setClientPickerOpen(false);
    loadClients();
  }, [visible]);

  const loadClients = useCallback(async () => {
    setClientsLoading(true);
    try {
      const rows = await listClients();
      setClients(Array.isArray(rows) ? rows : []);
    } catch {
      setClients([]);
    } finally {
      setClientsLoading(false);
    }
  }, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleClient(id) {
    setForm((f) => {
      const exists = f.clientIds.includes(id);
      return {
        ...f,
        clientIds: exists
          ? f.clientIds.filter((x) => x !== id)
          : [...f.clientIds, id],
      };
    });
  }

  const selectedClients = useMemo(
    () => clients.filter((c) => form.clientIds.includes(c.id)),
    [clients, form.clientIds]
  );

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const hay = [c.name, c.email, c.phone].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [clients, clientQuery]);

  async function runCnrLookup() {
    const trimmed = form.cnr.trim().toUpperCase();
    if (!trimmed) {
      setLookupError('Enter a CNR to look up.');
      return;
    }
    setLookupBusy(true);
    setLookupError('');
    setLookup(null);
    try {
      const [detail, mine] = await Promise.all([
        getCaseByCnr(trimmed),
        getImportedCase(trimmed).catch(() => ({
          imported: false,
          caseId: null,
        })),
      ]);
      const court = (detail && detail.courtCaseData) || null;
      if (!court) {
        setLookupError(
          'No case found for this CNR on E-Courts. Double-check the number.'
        );
        return;
      }
      setLookup(detail);
      setExistingCase(mine || { imported: false, caseId: null });
      const petitioner = (court.petitioners || []).filter(Boolean)[0] || '';
      const respondent = (court.respondents || []).filter(Boolean)[0] || '';
      const title =
        petitioner && respondent
          ? `${petitioner} vs ${respondent}`
          : petitioner || court.cnr || '';
      const acts = Array.isArray(court.actsAndSections)
        ? court.actsAndSections.filter(Boolean).join(', ')
        : '';
      const nextHearing = court.nextHearingDate
        ? String(court.nextHearingDate).slice(0, 10)
        : '';
      setForm((f) => ({
        ...f,
        cnr: trimmed,
        title: f.title || title,
        category:
          f.category ||
          court.judicialSection ||
          court.caseCategory ||
          'Litigation',
        description: f.description || acts,
        caseNumber: f.caseNumber || court.caseNumber || court.filingNumber || '',
        courtName: f.courtName || court.courtName || court.courtCode || '',
        opposingParty: f.opposingParty || respondent,
        nextHearingDate: f.nextHearingDate || nextHearing,
      }));
    } catch (err) {
      setLookupError(
        err?.message ||
          'Could not fetch this case from E-Courts. Try again in a moment.'
      );
    } finally {
      setLookupBusy(false);
    }
  }

  function clearLookup() {
    setLookup(null);
    setExistingCase({ imported: false, caseId: null });
    setLookupError('');
  }

  function openDatePicker() {
    Keyboard.dismiss();
    setDraftDate(
      form.nextHearingDate ? new Date(form.nextHearingDate) : new Date()
    );
    setTimeout(() => setPickingDate(true), 50);
  }

  function commitDate() {
    if (draftDate) {
      set('nextHearingDate', draftDate.toISOString().slice(0, 10));
    }
    setPickingDate(false);
  }

  function onDateChange(event, picked) {
    if (Platform.OS !== 'ios') {
      if (event && event.type === 'dismissed') {
        setPickingDate(false);
        return;
      }
      if (picked) set('nextHearingDate', picked.toISOString().slice(0, 10));
      setPickingDate(false);
      return;
    }
    if (picked) setDraftDate(picked);
  }

  async function handleSubmit() {
    if (submitting) return;
    const title = form.title.trim();
    const category = form.category.trim();
    if (!title) return setError('Title is required.');
    if (!category) return setError('Category is required.');
    if (form.clientIds.length === 0)
      return setError('Pick at least one client.');

    // Auto-include the calling professional so the case shows up on
    // their dashboard without forcing a multi-assignee picker on a
    // mobile screen.
    const myPid = pickProfessionalId(user);

    setError('');
    setSubmitting(true);
    try {
      const payload = {
        title,
        category,
        clientIds: form.clientIds,
        description: form.description.trim() || undefined,
        priority: form.priority || 'medium',
        caseNumber: form.caseNumber.trim() || undefined,
        cnr: form.cnr.trim().toUpperCase() || undefined,
        courtName: form.courtName.trim() || undefined,
        opposingParty: form.opposingParty.trim() || undefined,
        nextHearingDate: form.nextHearingDate || undefined,
        status: 'open',
      };
      if (myPid) payload.professionalIds = [myPid];

      let result;
      if (lookup && !existingCase.imported) {
        // CNR was successfully looked up — route through the import
        // endpoint so the new case carries the full eciSnapshot and
        // gets `source='ecourts'` for future one-click syncs.
        result = await importCaseFromEcourts(form.cnr.trim().toUpperCase(), {
          clientIds: form.clientIds,
          overrides: {
            title,
            category,
            description: payload.description,
            priority: payload.priority,
            caseNumber: payload.caseNumber,
            courtName: payload.courtName,
            opposingParty: payload.opposingParty,
            nextHearingDate: payload.nextHearingDate,
          },
        });
      } else {
        result = await createCase(payload);
      }
      const created = (result && (result.case || result)) || null;
      onCreated?.(created);
      onClose?.();
    } catch (err) {
      setError(
        err?.message || 'Could not create the case. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => !submitting && onClose?.()}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Feather name="briefcase" size={16} color={colors.primary} />
            <Text style={styles.title}>New case</Text>
            <Pressable
              onPress={() => !submitting && onClose?.()}
              hitSlop={8}
              disabled={submitting}
            >
              <Feather name="x" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: spacing.lg,
              paddingBottom: spacing.xl,
              gap: spacing.md,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {/* CNR lookup */}
            <View style={styles.cnrCard}>
              <Text style={styles.sectionLabel}>
                E-Courts CNR (optional but recommended)
              </Text>
              <Text style={styles.cnrHint}>
                If the case is already filed at any Indian court, paste its
                CNR (16-char identifier). We&rsquo;ll fetch live data and
                prefill the form.
              </Text>
              <View style={styles.cnrRow}>
                <TextInput
                  value={form.cnr}
                  onChangeText={(t) => set('cnr', t)}
                  placeholder="e.g. DLST031234562024"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={[styles.input, { flex: 1 }]}
                  editable={!submitting}
                />
                <Pressable
                  onPress={runCnrLookup}
                  disabled={lookupBusy || submitting || !form.cnr.trim()}
                  style={({ pressed }) => [
                    styles.cnrLookupBtn,
                    {
                      opacity:
                        lookupBusy || submitting || !form.cnr.trim()
                          ? 0.55
                          : pressed
                            ? 0.85
                            : 1,
                    },
                  ]}
                >
                  {lookupBusy ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Feather name="search" size={12} color="#ffffff" />
                  )}
                  <Text style={styles.cnrLookupBtnText}>
                    {lookupBusy ? 'Looking…' : 'Look up'}
                  </Text>
                </Pressable>
              </View>
              {lookupError ? (
                <View style={styles.errorBox}>
                  <Feather
                    name="alert-circle"
                    size={11}
                    color={colors.danger}
                  />
                  <Text style={styles.errorText}>{lookupError}</Text>
                </View>
              ) : null}
              {lookup && !existingCase.imported ? (
                <View style={styles.lookupOkBox}>
                  <Feather name="check-circle" size={11} color="#065f46" />
                  <Text style={styles.lookupOkText}>
                    Match found — fields prefilled. Saving will import the
                    case so future syncs run live.
                  </Text>
                  <Pressable onPress={clearLookup} hitSlop={6}>
                    <Feather name="x" size={11} color="#065f46" />
                  </Pressable>
                </View>
              ) : null}
              {existingCase.imported ? (
                <View style={styles.lookupOkBox}>
                  <Feather name="info" size={11} color="#1e40af" />
                  <Text style={[styles.lookupOkText, { color: '#1e40af' }]}>
                    This CNR is already on your dashboard — open the existing
                    case from the list instead.
                  </Text>
                </View>
              ) : null}
            </View>

            <View>
              <Text style={styles.sectionLabel}>
                Title <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                value={form.title}
                onChangeText={(t) => set('title', t)}
                placeholder="Petitioner vs Respondent"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                editable={!submitting}
              />
            </View>

            <View>
              <Text style={styles.sectionLabel}>
                Category <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                value={form.category}
                onChangeText={(t) => set('category', t)}
                placeholder="e.g. Civil, Tax, GST, Family"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                editable={!submitting}
              />
            </View>

            <View>
              <Text style={styles.sectionLabel}>
                Clients <Text style={styles.required}>*</Text>
              </Text>
              <Pressable
                onPress={() => setClientPickerOpen(true)}
                style={({ pressed }) => [
                  styles.input,
                  styles.pickerTrigger,
                  { opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <Text
                  style={
                    selectedClients.length > 0
                      ? styles.pickerTriggerText
                      : styles.pickerTriggerPlaceholder
                  }
                  numberOfLines={1}
                >
                  {selectedClients.length > 0
                    ? selectedClients.map((c) => c.name).join(', ')
                    : 'Pick one or more clients'}
                </Text>
                <Feather
                  name="chevron-down"
                  size={14}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

            <View>
              <Text style={styles.sectionLabel}>Priority</Text>
              <View style={styles.pillRow}>
                {PRIORITY_OPTIONS.map((p) => {
                  const active = form.priority === p.value;
                  return (
                    <Pressable
                      key={p.value}
                      onPress={() => set('priority', p.value)}
                      style={({ pressed }) => [
                        styles.pill,
                        active ? styles.pillActive : null,
                        { opacity: pressed ? 0.92 : 1 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          active ? styles.pillTextActive : null,
                        ]}
                      >
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View>
              <Text style={styles.sectionLabel}>Case number</Text>
              <TextInput
                value={form.caseNumber}
                onChangeText={(t) => set('caseNumber', t)}
                placeholder="Internal case reference"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                editable={!submitting}
              />
            </View>

            <View>
              <Text style={styles.sectionLabel}>Court name</Text>
              <TextInput
                value={form.courtName}
                onChangeText={(t) => set('courtName', t)}
                placeholder="e.g. Delhi District Court"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                editable={!submitting}
              />
            </View>

            <View>
              <Text style={styles.sectionLabel}>Opposing party</Text>
              <TextInput
                value={form.opposingParty}
                onChangeText={(t) => set('opposingParty', t)}
                placeholder="Respondent / other side"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                editable={!submitting}
              />
            </View>

            <View>
              <Text style={styles.sectionLabel}>Next hearing</Text>
              <Pressable
                onPress={openDatePicker}
                style={({ pressed }) => [
                  styles.input,
                  styles.pickerTrigger,
                  { opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <Feather name="calendar" size={13} color={colors.textMuted} />
                <Text
                  style={
                    form.nextHearingDate
                      ? styles.pickerTriggerText
                      : styles.pickerTriggerPlaceholder
                  }
                >
                  {form.nextHearingDate || 'Pick a date'}
                </Text>
                {form.nextHearingDate ? (
                  <Pressable
                    onPress={() => set('nextHearingDate', '')}
                    hitSlop={6}
                  >
                    <Feather name="x" size={11} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </Pressable>
            </View>

            <View>
              <Text style={styles.sectionLabel}>Description</Text>
              <TextInput
                value={form.description}
                onChangeText={(t) => set('description', t)}
                placeholder="Background, facts, current status…"
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.multiInput]}
                editable={!submitting}
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={11} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={() => !submitting && onClose?.()}
              disabled={submitting}
              style={({ pressed }) => [
                styles.cancelBtn,
                { opacity: submitting ? 0.5 : pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting || existingCase.imported}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  opacity:
                    submitting || existingCase.imported
                      ? 0.55
                      : pressed
                        ? 0.9
                        : 1,
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Feather name="check" size={12} color="#ffffff" />
              )}
              <Text style={styles.primaryText}>
                {submitting
                  ? lookup
                    ? 'Importing…'
                    : 'Creating…'
                  : lookup && !existingCase.imported
                    ? 'Import from E-Courts'
                    : 'Create case'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ClientPickerSheet
        visible={clientPickerOpen}
        onClose={() => setClientPickerOpen(false)}
        loading={clientsLoading}
        clients={filteredClients}
        selectedIds={form.clientIds}
        onToggle={toggleClient}
        query={clientQuery}
        onQueryChange={setClientQuery}
      />

      {/* Date picker — Android system dialog, iOS bottom-sheet. */}
      {Platform.OS === 'android' && pickingDate ? (
        <DateTimePicker
          value={draftDate || new Date()}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      ) : null}
      {Platform.OS === 'ios' ? (
        <Modal
          visible={pickingDate}
          transparent
          animationType="slide"
          onRequestClose={() => setPickingDate(false)}
        >
          <Pressable
            style={styles.dateBackdrop}
            onPress={() => setPickingDate(false)}
          />
          <View style={styles.dateSheet}>
            <View style={styles.dateSheetHead}>
              <Pressable onPress={() => setPickingDate(false)} hitSlop={8}>
                <Text style={styles.dateSheetCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.dateSheetTitle}>Next hearing</Text>
              <Pressable onPress={commitDate} hitSlop={8}>
                <Text style={styles.dateSheetDone}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={draftDate || new Date()}
              mode="date"
              display="spinner"
              onChange={onDateChange}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        </Modal>
      ) : null}
    </Modal>
  );
}

function ClientPickerSheet({
  visible,
  onClose,
  loading,
  clients,
  selectedIds,
  onToggle,
  query,
  onQueryChange,
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.clientBackdrop}>
        <View style={styles.clientSheet}>
          <View style={styles.clientHead}>
            <Text style={styles.clientTitle}>Pick clients</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.clientDone}>Done</Text>
            </Pressable>
          </View>
          <View style={styles.clientSearchRow}>
            <Feather
              name="search"
              size={13}
              color={colors.textMuted}
              style={{ marginRight: 6 }}
            />
            <TextInput
              value={query}
              onChangeText={onQueryChange}
              placeholder="Search clients…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.clientSearchInput}
            />
          </View>
          {loading ? (
            <View style={{ padding: spacing.lg, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : clients.length === 0 ? (
            <Text style={styles.clientEmpty}>
              No clients linked to you yet. Create or invite a client from the
              Clients section first.
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: '70%' }}>
              {clients.map((c) => {
                const active = selectedIds.includes(c.id);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => onToggle(c.id)}
                    style={({ pressed }) => [
                      styles.clientRow,
                      active ? styles.clientRowActive : null,
                      { opacity: pressed ? 0.94 : 1 },
                    ]}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        active ? styles.checkboxActive : null,
                      ]}
                    >
                      {active ? (
                        <Feather name="check" size={11} color="#ffffff" />
                      ) : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.clientName} numberOfLines={1}>
                        {c.name || c.email || c.phone || c.id}
                      </Text>
                      {c.phone || c.email ? (
                        <Text style={styles.clientMeta} numberOfLines={1}>
                          {[c.phone, c.email].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function pickProfessionalId(user) {
  if (!user) return null;
  // Pro user objects expose the ProfessionalDetail row id under a few
  // historical names; pick the first that exists.
  return (
    user.professionalId ||
    user.proId ||
    (user.professional && user.professional.id) ||
    null
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    height: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 5,
  },
  required: { color: colors.danger },

  input: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  multiInput: { minHeight: 80, maxHeight: 200 },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pickerTriggerText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  pickerTriggerPlaceholder: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  pillText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
  pillTextActive: { color: colors.primary },

  cnrCard: {
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: radius.md,
    backgroundColor: '#fffbeb',
    gap: 6,
  },
  cnrHint: {
    fontSize: 11,
    color: '#92400e',
    lineHeight: 16,
  },
  cnrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cnrLookupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: '#b45309',
  },
  cnrLookupBtnText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  lookupOkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: radius.md,
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#6ee7b7',
  },
  lookupOkText: {
    flex: 1,
    fontSize: 11,
    color: '#065f46',
    lineHeight: 15,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: radius.md,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorText: { flex: 1, fontSize: 11, color: '#b91c1c' },

  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  primaryText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },

  // Client picker sheet
  clientBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  clientSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    maxHeight: '80%',
  },
  clientHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  clientTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  clientDone: {
    fontSize: 13,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  clientSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  clientSearchInput: {
    flex: 1,
    paddingVertical: 9,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  clientEmpty: {
    paddingVertical: spacing.lg,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  clientRowActive: { backgroundColor: colors.primarySoft },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  clientName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  clientMeta: { marginTop: 1, fontSize: 11, color: colors.textMuted },

  // Date picker
  dateBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  dateSheet: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  dateSheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateSheetTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  dateSheetCancel: { fontSize: 13, color: colors.textSecondary },
  dateSheetDone: {
    fontSize: 13,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
});
