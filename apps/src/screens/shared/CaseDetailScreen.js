// CaseDetailScreen — mobile mirror of the web's client/professional
// case detail page (frontend/components/cases/CaseDetail.js).
//
// Sections rendered top → bottom:
//   1. Header card    — title + status / priority / CNR badges + Refresh
//   2. Client card    — name / phone / email / city of every party
//   3. Details card   — Category, Court name, Opposing party, Case
//                       number, Next hearing, Created, Assigned to,
//                       Description
//   4. Updates card   — case updates (title + body + scheduled date)
//   5. Notes card     — message thread + post-a-note form
//
// Pull-to-refresh on the outer scroll reloads everything.

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
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
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import AvatarWithInitials from '../../components/common/AvatarWithInitials';
import {
  addCaseNote,
  addCaseUpdate,
  deleteCase,
  deleteCaseNote,
  deleteCaseUpdate,
  editCaseNote,
  editCaseUpdate,
  getCase,
  leaveCase,
  listCaseLog,
  listCaseNotes,
  listCaseUpdates,
  syncCaseFromEcourts,
  updateCase,
} from '../../services/caseService';
import { uploadFile } from '../../services/uploadService';
import { useCaseAttachmentUrl } from '../../services/caseAttachmentService';
import { useAuth } from '../../contexts/AuthContext';
import { displayName, formatDate } from '../../utils/formatters';
import { imageUrl } from '../../utils/imageUrl';
import { ROLES } from '../../config/constants';
import CaseStageTracker from '../../components/cases/CaseStageTracker';
import CaseAiClerk from '../../components/cases/CaseAiClerk';
import EcourtsSyncDialog from '../../components/cases/EcourtsSyncDialog';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

// --- Update-task option vocab — same tokens the web composer uses. -

const UPDATE_STATUS_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
];

const UPDATE_PRIORITY_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];

const TASK_STATUS_LABEL = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

const TASK_STATUS_STYLES = {
  open: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  in_progress: { backgroundColor: '#dbeafe', borderColor: '#93c5fd' },
  done: { backgroundColor: '#d1fae5', borderColor: '#6ee7b7' },
  cancelled: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
};
const TASK_STATUS_TEXT_STYLES = {
  open: { color: '#475569' },
  in_progress: { color: '#1e40af' },
  done: { color: '#065f46' },
  cancelled: { color: '#b91c1c' },
};

const TASK_PRIORITY_STYLES = {
  low: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  normal: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  high: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
};
const TASK_PRIORITY_TEXT_STYLES = {
  low: { color: '#475569' },
  normal: { color: '#475569' },
  high: { color: '#b91c1c' },
};

// --- Status / priority colour maps — same vocabulary as the web. ----

const STATUS_VARIANT = {
  open: 'amber',
  'in-progress': 'amber',
  in_progress: 'amber',
  closed: 'gray',
};

const STATUS_LABEL = {
  open: 'Open',
  'in-progress': 'In progress',
  in_progress: 'In progress',
  closed: 'Closed',
};

const PRIORITY_VARIANT = {
  low: 'gray',
  medium: 'gray',
  high: 'amber',
  urgent: 'amber',
};

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------

export default function CaseDetailScreen({ navigation, route }) {
  const { caseId } = route.params || {};
  const { user } = useAuth();
  const isClient = user && user.role === ROLES.CLIENT;

  const [item, setItem] = useState(null);
  const [notes, setNotes] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [updatesError, setUpdatesError] = useState('');
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Delete-case flow state — typed confirmation to mirror the web.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Leave-case flow (firm cases with 2+ professionals).
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  // E-Courts sync dialog state.
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState('');

  // AI Clerk drawer.
  const [aiOpen, setAiOpen] = useState(false);

  // Edit case modal.
  const [editOpen, setEditOpen] = useState(false);

  // Compose-a-note form state — body + uploaded attachment list.
  const [noteBody, setNoteBody] = useState('');
  const [noteAttachments, setNoteAttachments] = useState([]);
  const [attachUploading, setAttachUploading] = useState(false);
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteError, setNoteError] = useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      if (!caseId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const [c, n, u, l] = await Promise.allSettled([
          getCase(caseId),
          listCaseNotes(caseId),
          listCaseUpdates(caseId),
          listCaseLog(caseId),
        ]);
        if (c.status === 'fulfilled') {
          const payload = c.value;
          setItem((payload && payload.case) || payload);
        } else if (!isRefresh) {
          setError(c.reason?.message || 'Failed to load case.');
        }
        if (n.status === 'fulfilled') setNotes(n.value || []);
        if (u.status === 'fulfilled') {
          setUpdates(u.value || []);
          setUpdatesError('');
        } else {
          // Surface load failures inline instead of swallowing them —
          // the user reported "Updates is not showing"; an HTTP error
          // (auth, network, 5xx) needs to be visible so it can be
          // acted on rather than mistaken for an empty case.
          setUpdates([]);
          setUpdatesError(u.reason?.message || 'Could not load updates.');
        }
        if (l.status === 'fulfilled') setLog(l.value || []);
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [caseId]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  // --- Note composer actions -------------------------------------------

  async function handleAttach() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Photo library access',
          'Allow access to your photos so you can attach files to this note.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsMultipleSelection: false,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      const asset = result.assets[0];
      setAttachUploading(true);
      const uploaded = await uploadFile({
        uri: asset.uri,
        name: asset.fileName || `note-${Date.now()}.jpg`,
        type: asset.mimeType,
        // `case_note` is the backend's compression bucket for case
        // attachments — keeps images under 300 KB before storing. The
        // backend also requires the case id so it can authorise the
        // upload and file the object under case-files/<caseId>/.
        category: 'case_note',
        caseId,
      });
      const url = uploaded && (uploaded.url || uploaded.publicUrl || uploaded.path);
      if (!url) throw new Error('Upload did not return a URL.');
      const name =
        uploaded.originalName ||
        uploaded.name ||
        asset.fileName ||
        String(url).split('/').pop();
      setNoteAttachments((prev) =>
        prev.some((a) => a.url === url) ? prev : [...prev, { url, name }]
      );
    } catch (err) {
      Alert.alert('Attachment failed', err?.message || 'Could not upload file.');
    } finally {
      setAttachUploading(false);
    }
  }

  function removeAttachment(url) {
    setNoteAttachments((prev) => prev.filter((a) => a.url !== url));
  }

  async function handlePostNote() {
    if (noteSubmitting) return;
    const body = noteBody.trim();
    if (!body && noteAttachments.length === 0) {
      setNoteError('Write something or attach a file before posting.');
      return;
    }
    setNoteError('');
    setNoteSubmitting(true);
    try {
      await addCaseNote(caseId, {
        body,
        attachments: noteAttachments,
      });
      setNoteBody('');
      setNoteAttachments([]);
      // Refresh notes + log only — case + updates haven't changed.
      const [fresh, freshLog] = await Promise.allSettled([
        listCaseNotes(caseId),
        listCaseLog(caseId),
      ]);
      if (fresh.status === 'fulfilled') setNotes(fresh.value || []);
      if (freshLog.status === 'fulfilled') setLog(freshLog.value || []);
    } catch (err) {
      setNoteError(err?.message || 'Could not post the note.');
    } finally {
      setNoteSubmitting(false);
    }
  }

  // --- Delete / leave gates --------------------------------------------

  function caseHasProfessional(c) {
    if (!c) return false;
    if (c.professionalId) return true;
    if (Array.isArray(c.professionalIds) && c.professionalIds.length > 0) {
      return true;
    }
    return false;
  }
  const assignedProIds = (() => {
    if (!item) return [];
    if (Array.isArray(item.professionalIds)) return item.professionalIds.filter(Boolean);
    if (item.professionalId) return [item.professionalId];
    return [];
  })();
  const isFirmShared = assignedProIds.length >= 2;
  // Pros leave when they share the case with at least one teammate;
  // delete is reserved for solo-assignee pros (or clients on cases
  // with no professional yet, per the backend's carve-out).
  const canLeave = !isClient && isFirmShared;
  const canDelete =
    !canLeave &&
    item &&
    ((isClient && !caseHasProfessional(item)) ||
      (!isClient && assignedProIds.length <= 1));
  const canEditCase = !isClient && !isFirmShared;

  function openDeleteConfirm() {
    setDeleteConfirm('');
    setDeleteError('');
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (deleting) return;
    if (deleteConfirm.trim().toLowerCase() !== 'delete') {
      setDeleteError('Type "delete" to confirm.');
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteCase(caseId);
      setDeleteOpen(false);
      navigation.goBack?.();
    } catch (err) {
      setDeleteError(
        err?.message || 'Something went wrong while deleting the case.'
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleLeave() {
    if (leaving) return;
    setLeaving(true);
    setLeaveError('');
    try {
      await leaveCase(caseId);
      setLeaveOpen(false);
      navigation.goBack?.();
    } catch (err) {
      setLeaveError(
        err?.message || 'Could not leave the case. Try again later.'
      );
    } finally {
      setLeaving(false);
    }
  }

  // --- E-Courts sync ---------------------------------------------------

  async function handleSync() {
    if (!item || !item.cnr) return;
    setSyncOpen(true);
    setSyncBusy(true);
    setSyncError('');
    setSyncResult(null);
    try {
      const res = await syncCaseFromEcourts(caseId);
      setSyncResult(res || null);
      // Refresh the case + log so the header reflects any fields that
      // changed (next hearing, status, etc.).
      const [fresh, freshLog] = await Promise.allSettled([
        getCase(caseId),
        listCaseLog(caseId),
      ]);
      if (fresh.status === 'fulfilled') {
        const payload = fresh.value;
        setItem((payload && payload.case) || payload);
      }
      if (freshLog.status === 'fulfilled') setLog(freshLog.value || []);
    } catch (err) {
      setSyncError(err?.message || 'Sync failed. E-Courts may be slow — try again.');
    } finally {
      setSyncBusy(false);
    }
  }

  // --- Edit case -------------------------------------------------------

  async function handleEditSave(payload) {
    try {
      const updated = await updateCase(caseId, payload);
      const next = (updated && updated.case) || updated;
      if (next) setItem(next);
      const freshLog = await listCaseLog(caseId).catch(() => null);
      if (Array.isArray(freshLog)) setLog(freshLog);
      setEditOpen(false);
    } catch (err) {
      throw err;
    }
  }

  // --- AI Clerk reload bridge -----------------------------------------

  async function handleAiSaved() {
    const [c, u, l] = await Promise.allSettled([
      getCase(caseId),
      listCaseUpdates(caseId),
      listCaseLog(caseId),
    ]);
    if (c.status === 'fulfilled') {
      const payload = c.value;
      setItem((payload && payload.case) || payload);
    }
    if (u.status === 'fulfilled') {
      setUpdates(u.value || []);
      setUpdatesError('');
    }
    if (l.status === 'fulfilled') setLog(l.value || []);
  }

  // Pro-only: stage was patched via CaseStageTracker. Update local
  // item so the header reflects the new state without a full reload.
  function handleStageUpdated(updated) {
    const next = (updated && updated.case) || updated;
    if (next) setItem((cur) => ({ ...cur, ...next }));
    listCaseLog(caseId).then((l) => setLog(l || [])).catch(() => {});
  }

  if (loading && !item) {
    return (
      <ScreenContainer hasNavHeader>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (error && !item) {
    return (
      <ScreenContainer hasNavHeader>
        <EmptyState
          icon="alert-circle"
          title="Could not load case"
          description={error}
        />
      </ScreenContainer>
    );
  }

  if (!item) {
    return (
      <ScreenContainer hasNavHeader>
        <EmptyState
          icon="folder"
          title="Case not found"
          description="This case may have been removed."
        />
      </ScreenContainer>
    );
  }

  // Resolve a "clients" array regardless of the response shape. Newer
  // responses expose `clients[]`; older ones inline the primary client
  // directly on the case.
  const clients = (() => {
    if (Array.isArray(item.clients) && item.clients.length > 0) {
      return item.clients;
    }
    if (item.client) return [item.client];
    if (item.clientName || item.clientPhone || item.clientEmail) {
      return [
        {
          id: item.clientId || 'client',
          name: item.clientName,
          phone: item.clientPhone,
          email: item.clientEmail,
          city: item.clientCity,
        },
      ];
    }
    return [];
  })();

  const professionals = (() => {
    if (Array.isArray(item.professionals) && item.professionals.length > 0) {
      return item.professionals;
    }
    if (item.professional) return [item.professional];
    if (item.professionalName || item.professionalId) {
      return [
        {
          publicId: item.professionalId,
          name: item.professionalName || item.professionalId,
        },
      ];
    }
    return [];
  })();

  return (
    <View style={{ flex: 1 }}>
      <ScreenContainer
        hasNavHeader
        keyboard
        refreshing={refreshing}
        onRefresh={() => load(true)}
        contentStyle={styles.contentStack}
      >
        <HeaderCard
          item={item}
          onRefresh={() => load(true)}
          onSync={item.cnr ? handleSync : null}
          syncBusy={syncBusy}
          onEdit={canEditCase ? () => setEditOpen(true) : null}
          refreshing={refreshing}
        />

        {/* Stage tracker — visible to every viewer so the workflow
            stage is part of the same shared layout. Clients see it
            read-only (the tracker hides the picker affordance); pros
            tap to change with an optimistic PATCH. */}
        <CaseStageTracker
          caseRow={item}
          onUpdated={handleStageUpdated}
          readOnly={isClient}
        />

        {/* AI Clerk summary — surfaces the last AI summary saved on
            the case so pros don't have to re-run it. */}
        {!isClient && item.aiSummary ? (
          <AiSummaryCard
            summary={item.aiSummary}
            updatedAt={item.aiSummaryUpdatedAt}
            onRegenerate={() => setAiOpen(true)}
          />
        ) : null}

        {/* Clients section is hidden for clients viewing their own case —
            they already know who they are. Pros still see it so they can
            look up the client's contact details. */}
        {isClient ? null : <ClientsCard clients={clients} />}

        <DetailsCard item={item} professionals={professionals} />

        <UpdatesCard
          updates={updates}
          loadError={updatesError}
          caseId={caseId}
          canEdit={!isClient}
          onChanged={async () => {
            const [u, l] = await Promise.allSettled([
              listCaseUpdates(caseId),
              listCaseLog(caseId),
            ]);
            if (u.status === 'fulfilled') {
              setUpdates(u.value || []);
              setUpdatesError('');
            }
            if (l.status === 'fulfilled') setLog(l.value || []);
          }}
        />

        <NotesCard
          notes={notes}
          currentUser={user}
          caseId={caseId}
          canEdit={!isClient}
          noteBody={noteBody}
          setNoteBody={setNoteBody}
          attachments={noteAttachments}
          onAttach={handleAttach}
          onRemoveAttach={removeAttachment}
          attachUploading={attachUploading}
          submitting={noteSubmitting}
          error={noteError}
          onPost={handlePostNote}
          onNotesChanged={async () => {
            const [fresh, freshLog] = await Promise.allSettled([
              listCaseNotes(caseId),
              listCaseLog(caseId),
            ]);
            if (fresh.status === 'fulfilled') setNotes(fresh.value || []);
            if (freshLog.status === 'fulfilled') setLog(freshLog.value || []);
          }}
        />

        <ActivityLogCard entries={log} />

        {/* Danger zone — leave for firm-shared cases, delete otherwise.
            Backend enforces both rules; the gates below mirror them. */}
        {canLeave ? (
          <LeaveCaseCard
            assigneeCount={assignedProIds.length}
            onPress={() => {
              setLeaveError('');
              setLeaveOpen(true);
            }}
          />
        ) : null}
        {canDelete ? (
          <DeleteCaseCard onPress={openDeleteConfirm} busy={deleting} />
        ) : null}

        {/* Bottom spacer so the FAB doesn't cover the last card. */}
        {!isClient ? <View style={{ height: 72 }} /> : null}
      </ScreenContainer>

      {/* Floating AI Clerk button (pros only). Mirrors the web's
          floating bot — opens a full-height sheet with the same four
          actions (summarize / next step / prompt / analyse). */}
      {!isClient ? (
        <Pressable
          onPress={() => setAiOpen(true)}
          style={({ pressed }) => [
            styles.aiFab,
            { opacity: pressed ? 0.94 : 1 },
          ]}
        >
          <Feather name="zap" size={18} color="#ffffff" />
          <Text style={styles.aiFabText}>AI Clerk</Text>
        </Pressable>
      ) : null}

      {/* AI Clerk drawer — defensively gated to non-clients in case
          some future code path tries to flip aiOpen. */}
      {!isClient ? (
        <CaseAiClerk
          caseId={caseId}
          visible={aiOpen}
          onClose={() => setAiOpen(false)}
          onSaved={handleAiSaved}
        />
      ) : null}

      <EcourtsSyncDialog
        visible={syncOpen}
        busy={syncBusy}
        error={syncError}
        result={syncResult}
        onClose={() => {
          setSyncOpen(false);
          setSyncResult(null);
          setSyncError('');
        }}
      />

      <DeleteConfirmModal
        visible={deleteOpen}
        title={item.title}
        confirmText={deleteConfirm}
        onChangeConfirmText={setDeleteConfirm}
        error={deleteError}
        busy={deleting}
        onCancel={() => {
          if (!deleting) setDeleteOpen(false);
        }}
        onConfirm={handleDelete}
      />

      <LeaveConfirmModal
        visible={leaveOpen}
        busy={leaving}
        error={leaveError}
        onCancel={() => {
          if (!leaving) setLeaveOpen(false);
        }}
        onConfirm={handleLeave}
      />

      <EditCaseModal
        visible={editOpen}
        caseRow={item}
        onCancel={() => setEditOpen(false)}
        onSave={handleEditSave}
      />
    </View>
  );
}

// ---------------------------------------------------------------------
// Header card — title + badges + refresh
// ---------------------------------------------------------------------

function HeaderCard({
  item,
  onRefresh,
  onSync,
  syncBusy,
  onEdit,
  refreshing,
}) {
  const statusKey = String(item.status || 'open').toLowerCase();
  const priorityKey = String(item.priority || 'medium').toLowerCase();
  return (
    <Card>
      <View style={{ gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={3}>
            {item.title || 'Untitled case'}
          </Text>
          <View style={styles.badgeRow}>
            <Badge variant={STATUS_VARIANT[statusKey] || 'gray'}>
              {STATUS_LABEL[statusKey] || item.status || 'Open'}
            </Badge>
            <Badge variant={PRIORITY_VARIANT[priorityKey] || 'gray'}>
              {item.priority || 'medium'}
            </Badge>
            {item.category ? (
              <Badge variant="gray">{item.category}</Badge>
            ) : null}
          </View>
          {item.cnr ? (
            <View style={styles.cnrChip}>
              <Feather name="award" size={11} color="#92400e" />
              <Text style={styles.cnrText}>CNR </Text>
              <Text style={styles.cnrTextMono}>{item.cnr}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          <HeaderActionBtn
            icon="refresh-cw"
            label={refreshing ? 'Refreshing…' : 'Refresh'}
            onPress={onRefresh}
            disabled={refreshing}
          />
          {onSync ? (
            <HeaderActionBtn
              icon="git-merge"
              label={syncBusy ? 'Syncing…' : 'Sync E-Courts'}
              onPress={onSync}
              disabled={syncBusy}
              tone="primary"
            />
          ) : null}
          {onEdit ? (
            <HeaderActionBtn
              icon="edit-2"
              label="Edit"
              onPress={onEdit}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function HeaderActionBtn({ icon, label, onPress, disabled, tone }) {
  const isPrimary = tone === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        styles.headerActionBtn,
        isPrimary ? styles.headerActionBtnPrimary : null,
        { opacity: disabled ? 0.55 : pressed ? 0.85 : 1 },
      ]}
    >
      <Feather
        name={icon}
        size={12}
        color={isPrimary ? '#ffffff' : colors.primary}
      />
      <Text
        style={[
          styles.headerActionText,
          isPrimary ? styles.headerActionTextPrimary : null,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------
// Clients card — name + phone + email + city
// ---------------------------------------------------------------------

function ClientsCard({ clients }) {
  return (
    <Card>
      <SectionHeader icon="user" label={clients.length > 1 ? `Clients (${clients.length})` : 'Client'} />
      {clients.length === 0 ? (
        <Text style={styles.muted}>No clients linked to this case.</Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {clients.map((c) => (
            <View key={c.id || c.email || c.phone} style={styles.clientRow}>
              <AvatarWithInitials
                uri={imageUrl(c.profilePhoto || c.photo)}
                name={c.name || c.email || 'Client'}
                size={36}
                style={{ borderRadius: 18 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName} numberOfLines={1}>
                  {c.name || c.email || c.phone || c.id}
                </Text>
                <View style={styles.clientMeta}>
                  {c.phone ? (
                    <View style={styles.metaPill}>
                      <Feather name="phone" size={10} color={colors.textMuted} />
                      <Text style={styles.metaText}>{c.phone}</Text>
                    </View>
                  ) : null}
                  {c.email ? (
                    <View style={styles.metaPill}>
                      <Feather name="mail" size={10} color={colors.textMuted} />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {c.email}
                      </Text>
                    </View>
                  ) : null}
                  {c.city ? (
                    <View style={styles.metaPill}>
                      <Feather name="map-pin" size={10} color={colors.textMuted} />
                      <Text style={styles.metaText}>{c.city}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------
// Details card — Category, Court name, etc.
// ---------------------------------------------------------------------

function DetailsCard({ item, professionals }) {
  return (
    <Card>
      <SectionHeader icon="briefcase" label="Case details" />
      <View style={styles.detailGrid}>
        <Field label="Category" value={item.category} />
        <Field label="Court name" value={item.courtName} />
        <Field label="Opposing party" value={item.opposingParty} />
        <Field label="Case number" value={item.caseNumber} />
        <Field
          label="Next hearing"
          value={
            item.nextHearingDate ? formatDate(item.nextHearingDate) : null
          }
        />
        <Field label="Created" value={formatDate(item.createdAt)} />
      </View>

      {professionals.length > 0 ? (
        <View style={styles.assignedBlock}>
          <Text style={styles.detailLabel}>Assigned to</Text>
          <View style={styles.assignedRow}>
            {professionals.map((p) => (
              <View key={p.publicId || p.id || p.name} style={styles.proChip}>
                <Feather name="user" size={10} color="#1d4ed8" />
                <Text style={styles.proChipText} numberOfLines={1}>
                  {p.name || p.publicId || 'Professional'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {item.description ? (
        <View style={styles.descriptionBlock}>
          <Text style={styles.detailLabel}>Description</Text>
          <Text style={styles.descriptionText}>{item.description}</Text>
        </View>
      ) : null}
    </Card>
  );
}

function Field({ label, value }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || '—'}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------
// Updates card — rich updates (title + body + scheduled date)
// ---------------------------------------------------------------------

function UpdatesCard({ updates, loadError, caseId, canEdit, onChanged }) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState(null); // update object being edited
  const [deletingId, setDeletingId] = useState('');

  function startNew() {
    setEditing(null);
    setComposerOpen(true);
  }

  function startEdit(u) {
    setEditing(u);
    setComposerOpen(true);
  }

  async function handleDelete(u) {
    if (deletingId) return;
    setDeletingId(u.id);
    try {
      await deleteCaseUpdate(caseId, u.id);
      if (typeof onChanged === 'function') await onChanged();
    } catch (err) {
      Alert.alert(
        'Delete failed',
        err?.message || 'Could not delete the update.'
      );
    } finally {
      setDeletingId('');
    }
  }

  return (
    <Card>
      <View style={styles.updatesHead}>
        <SectionHeader
          icon="calendar"
          label={
            updates.length > 0
              ? `Case updates (${updates.length})`
              : 'Case updates'
          }
        />
        {canEdit ? (
          <Pressable
            onPress={startNew}
            style={({ pressed }) => [
              styles.addUpdateBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Feather name="plus" size={13} color={colors.textInverse} />
            <Text style={styles.addUpdateText}>Add update</Text>
          </Pressable>
        ) : null}
      </View>
      {loadError ? (
        <View style={styles.inlineError}>
          <Feather name="alert-circle" size={13} color={colors.danger} />
          <Text style={styles.inlineErrorText}>{loadError}</Text>
        </View>
      ) : null}
      {updates.length === 0 ? (
        <Text style={styles.muted}>
          {canEdit
            ? 'No updates yet. Tap “Add update” to log a hearing summary, scheduled milestone, or status note.'
            : 'Your professional’s scheduled updates and hearing notes will appear here.'}
        </Text>
      ) : (
        <View style={{ gap: spacing.md }}>
          {updates.slice(0, 8).map((u) => {
            const busy = deletingId === u.id;
            return (
              <View key={u.id} style={styles.updateRow}>
                <View style={styles.updateDot} />
                <View style={{ flex: 1 }}>
                  <View style={styles.updateHeadRow}>
                    <Text style={styles.updateTitle} numberOfLines={2}>
                      {u.title || 'Update'}
                    </Text>
                    {u.scheduledAt ? (
                      <Text style={styles.updateWhen}>
                        {formatDate(u.scheduledAt)}
                      </Text>
                    ) : null}
                  </View>
                  {u.body ? (
                    <Text style={styles.updateBody}>{u.body}</Text>
                  ) : null}
                  <View style={styles.updateMetaRow}>
                    {u.nextHearingDate ? (
                      <View style={styles.hearingPill}>
                        <Feather name="calendar" size={10} color="#92400e" />
                        <Text style={styles.hearingText}>
                          Next hearing {formatDate(u.nextHearingDate)}
                        </Text>
                      </View>
                    ) : null}
                    {u.dueDate ? (
                      <View style={styles.duePill}>
                        <Feather name="clock" size={10} color="#1e40af" />
                        <Text style={styles.dueText}>
                          Due {formatDate(u.dueDate)}
                        </Text>
                      </View>
                    ) : null}
                    {u.status ? (
                      <View
                        style={[
                          styles.taskBadge,
                          TASK_STATUS_STYLES[u.status] || TASK_STATUS_STYLES.open,
                        ]}
                      >
                        <Text
                          style={[
                            styles.taskBadgeText,
                            TASK_STATUS_TEXT_STYLES[u.status] || null,
                          ]}
                        >
                          {TASK_STATUS_LABEL[u.status] || u.status}
                        </Text>
                      </View>
                    ) : null}
                    {u.priority ? (
                      <View
                        style={[
                          styles.taskBadge,
                          TASK_PRIORITY_STYLES[u.priority] || TASK_PRIORITY_STYLES.normal,
                        ]}
                      >
                        <Text
                          style={[
                            styles.taskBadgeText,
                            TASK_PRIORITY_TEXT_STYLES[u.priority] || null,
                          ]}
                        >
                          {String(u.priority).toUpperCase()}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <AttachmentList
                    attachments={u.attachments}
                    keyPrefix={u.id}
                    caseId={caseId}
                  />
                  {canEdit ? (
                    <View style={styles.updateActions}>
                      <Pressable
                        onPress={() => startEdit(u)}
                        disabled={busy}
                        style={({ pressed }) => [
                          styles.updateActionBtn,
                          { opacity: pressed ? 0.85 : 1 },
                        ]}
                      >
                        <Feather name="edit-2" size={11} color={colors.primary} />
                        <Text style={styles.updateActionText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          Alert.alert(
                            'Delete update',
                            'This will remove the update permanently.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => handleDelete(u),
                              },
                            ]
                          )
                        }
                        disabled={busy}
                        style={({ pressed }) => [
                          styles.updateActionBtn,
                          styles.updateDangerBtn,
                          { opacity: pressed ? 0.85 : 1 },
                        ]}
                      >
                        <Feather
                          name="trash-2"
                          size={11}
                          color={colors.danger}
                        />
                        <Text style={styles.updateDangerText}>
                          {busy ? 'Deleting…' : 'Delete'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <UpdateComposerModal
        visible={composerOpen}
        caseId={caseId}
        editing={editing}
        onClose={() => setComposerOpen(false)}
        onSaved={async () => {
          setComposerOpen(false);
          setEditing(null);
          if (typeof onChanged === 'function') await onChanged();
        }}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------
// UpdateComposerModal — add / edit a case update.
// Same fields the web's case-update form ships: title, body,
// scheduledAt, nextHearingDate, attachments (image upload via
// expo-image-picker, sent to /uploads with category `case_note`).
// ---------------------------------------------------------------------

function UpdateComposerModal({ visible, caseId, editing, onClose, onSaved }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [nextHearingDate, setNextHearingDate] = useState('');
  // Task fields — the same trio the web composer exposes. Empty
  // strings stay out of the payload so existing updates without task
  // metadata don't grow new defaults on edit.
  const [dueDate, setDueDate] = useState('');
  const [taskStatus, setTaskStatus] = useState('');
  const [taskPriority, setTaskPriority] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Tracks which date field has the native picker open: '' | 'scheduledAt'
  // | 'nextHearingDate' | 'dueDate'. iOS shows the picker inline;
  // Android shows it as a system dialog that auto-dismisses on pick.
  const [pickingField, setPickingField] = useState('');

  // Re-seed the form whenever the modal opens. Editing fills the
  // existing values; new-update mode clears every field.
  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setTitle(editing.title || '');
      setBody(editing.body || '');
      setScheduledAt(
        editing.scheduledAt ? String(editing.scheduledAt).slice(0, 10) : ''
      );
      setNextHearingDate(
        editing.nextHearingDate
          ? String(editing.nextHearingDate).slice(0, 10)
          : ''
      );
      setDueDate(
        editing.dueDate ? String(editing.dueDate).slice(0, 10) : ''
      );
      setTaskStatus(editing.status || '');
      setTaskPriority(editing.priority || '');
      setAttachments(
        Array.isArray(editing.attachments) ? editing.attachments : []
      );
    } else {
      setTitle('');
      setBody('');
      setScheduledAt('');
      setNextHearingDate('');
      setDueDate('');
      setTaskStatus('');
      setTaskPriority('');
      setAttachments([]);
    }
    setError('');
  }, [visible, editing]);

  async function attach() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Photo library access',
          'Allow access to your photos so you can attach files to this update.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsMultipleSelection: false,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      const asset = result.assets[0];
      setUploading(true);
      const uploaded = await uploadFile({
        uri: asset.uri,
        name: asset.fileName || `update-${Date.now()}.jpg`,
        type: asset.mimeType,
        category: 'case_note',
        caseId,
      });
      const url =
        uploaded && (uploaded.url || uploaded.publicUrl || uploaded.path);
      if (!url) throw new Error('Upload did not return a URL.');
      const name =
        uploaded.originalName ||
        uploaded.name ||
        asset.fileName ||
        String(url).split('/').pop();
      setAttachments((prev) =>
        prev.some((a) => a.url === url) ? prev : [...prev, { url, name }]
      );
    } catch (err) {
      Alert.alert(
        'Attachment failed',
        err?.message || 'Could not upload file.'
      );
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(url) {
    setAttachments((prev) => prev.filter((a) => a.url !== url));
  }

  async function save() {
    if (saving || uploading) return;
    const trimmedBody = body.trim();
    if (!trimmedBody && attachments.length === 0) {
      setError('Write an update or attach a file before saving.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload = {
        title: title.trim() || undefined,
        body: trimmedBody,
        scheduledAt: scheduledAt || undefined,
        nextHearingDate: nextHearingDate || undefined,
        dueDate: dueDate || undefined,
        status: taskStatus || undefined,
        priority: taskPriority || undefined,
        attachments,
      };
      if (editing) {
        await editCaseUpdate(caseId, editing.id, payload);
      } else {
        await addCaseUpdate(caseId, payload);
      }
      if (typeof onSaved === 'function') await onSaved();
    } catch (err) {
      setError(err?.message || 'Could not save the update.');
    } finally {
      setSaving(false);
    }
  }

  // Buffer the date the user is editing in the bottom-sheet so iOS
  // users can scroll the wheel without each tick writing back to the
  // form. Committed when they tap "Done".
  const [draftPickerDate, setDraftPickerDate] = useState(null);

  function openPicker(field) {
    // Drop the keyboard before showing the picker so the native sheet
    // / dialog appears on a clean surface — was the root cause of
    // "picker invisible / not switching with keyboard up".
    Keyboard.dismiss();
    const seed =
      field === 'scheduledAt'
        ? scheduledAt
        : field === 'nextHearingDate'
          ? nextHearingDate
          : dueDate;
    setDraftPickerDate(seed ? new Date(seed) : new Date());
    // Defer the open by a frame so the keyboard-dismiss animation
    // doesn't fight the picker's slide-in.
    setTimeout(() => setPickingField(field), 50);
  }

  function commitPickerValue(iso) {
    if (pickingField === 'scheduledAt') setScheduledAt(iso);
    else if (pickingField === 'nextHearingDate') setNextHearingDate(iso);
    else if (pickingField === 'dueDate') setDueDate(iso);
  }

  function commitPicker() {
    if (!pickingField || !draftPickerDate) {
      setPickingField('');
      return;
    }
    commitPickerValue(draftPickerDate.toISOString().slice(0, 10));
    setPickingField('');
  }

  function onPickerChange(event, picked) {
    // Android: system dialog returns once; commit and close.
    if (Platform.OS !== 'ios') {
      if (event && event.type === 'dismissed') {
        setPickingField('');
        return;
      }
      if (picked) {
        commitPickerValue(picked.toISOString().slice(0, 10));
      }
      setPickingField('');
      return;
    }
    // iOS: buffer in draftPickerDate; "Done" commits.
    if (picked) setDraftPickerDate(picked);
  }

  // Save is disabled while a file is uploading, while saving, or
  // when the form is empty — matches the request "save disabled
  // until image uploaded".
  const saveDisabled = saving || uploading;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => !saving && onClose()}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.composerBackdrop}
      >
        <View style={styles.composerCard}>
          <View style={styles.composerHead}>
            <Text style={styles.composerTitle}>
              {editing ? 'Edit update' : 'Add update'}
            </Text>
            <Pressable onPress={() => !saving && onClose()} hitSlop={8}>
              <Feather name="x" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}
          >
            <View style={styles.composerField}>
              <Text style={styles.composerLabel}>Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Hearing summary, scheduled milestone…"
                placeholderTextColor={colors.textMuted}
                style={styles.composerInput}
              />
            </View>

            <View style={styles.composerField}>
              <Text style={styles.composerLabel}>Details *</Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Describe what happened or what's next…"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={5}
                style={[styles.composerInput, styles.composerTextarea]}
              />
            </View>

            <View style={styles.composerField}>
              <Text style={styles.composerLabel}>Scheduled date</Text>
              <DateField
                value={scheduledAt}
                onPressOpen={() => openPicker('scheduledAt')}
                onClear={() => setScheduledAt('')}
                placeholder="Pick a date"
              />
            </View>

            <View style={styles.composerField}>
              <Text style={styles.composerLabel}>Next hearing</Text>
              <DateField
                value={nextHearingDate}
                onPressOpen={() => openPicker('nextHearingDate')}
                onClear={() => setNextHearingDate('')}
                placeholder="Pick a date"
              />
            </View>

            <View style={styles.taskPanel}>
              <Text style={styles.taskPanelTitle}>Treat as a task (optional)</Text>
              <View style={styles.composerField}>
                <Text style={styles.composerLabel}>Due date</Text>
                <DateField
                  value={dueDate}
                  onPressOpen={() => openPicker('dueDate')}
                  onClear={() => setDueDate('')}
                  placeholder="Pick a due date"
                />
              </View>
              <View style={styles.composerField}>
                <Text style={styles.composerLabel}>Status</Text>
                <PillPicker
                  options={UPDATE_STATUS_OPTIONS}
                  value={taskStatus}
                  onChange={setTaskStatus}
                />
              </View>
              <View style={styles.composerField}>
                <Text style={styles.composerLabel}>Priority</Text>
                <PillPicker
                  options={UPDATE_PRIORITY_OPTIONS}
                  value={taskPriority}
                  onChange={setTaskPriority}
                />
              </View>
            </View>

            <View style={styles.composerField}>
              <View style={styles.attachRow}>
                <Text style={styles.composerLabel}>Attachments</Text>
                <Pressable
                  onPress={attach}
                  disabled={uploading || saving}
                  style={({ pressed }) => [
                    styles.attachBtn,
                    {
                      opacity: pressed || uploading || saving ? 0.85 : 1,
                    },
                  ]}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Feather
                      name="paperclip"
                      size={12}
                      color={colors.primary}
                    />
                  )}
                  <Text style={styles.attachBtnText}>
                    {uploading ? 'Uploading…' : 'Attach file'}
                  </Text>
                </Pressable>
              </View>
              {attachments.length === 0 ? (
                <Text style={styles.attachHint}>
                  {uploading
                    ? 'Uploading… Save will be enabled once the upload finishes.'
                    : 'Add images / scanned documents. They render inline with the update and open in the device browser on tap.'}
                </Text>
              ) : (
                <View style={styles.attachList}>
                  {attachments.map((a) => (
                    <View key={a.url} style={styles.attachItem}>
                      <Feather
                        name="paperclip"
                        size={11}
                        color={colors.textMuted}
                      />
                      <Text style={styles.attachItemName} numberOfLines={1}>
                        {prettyAttachmentName(a, 0)}
                      </Text>
                      <Pressable
                        onPress={() => removeAttachment(a.url)}
                        hitSlop={6}
                      >
                        <Feather name="x" size={11} color={colors.danger} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {error ? (
              <View style={styles.inlineError}>
                <Feather
                  name="alert-circle"
                  size={13}
                  color={colors.danger}
                />
                <Text style={styles.inlineErrorText}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.composerActions}>
            <Pressable
              onPress={() => !saving && onClose()}
              disabled={saving}
              style={({ pressed }) => [
                styles.composerCancel,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.composerCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={save}
              disabled={saveDisabled}
              style={({ pressed }) => [
                styles.composerSave,
                saveDisabled && styles.composerSaveDisabled,
                { opacity: pressed || saveDisabled ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.composerSaveText}>
                {uploading
                  ? 'Waiting for upload…'
                  : saving
                    ? 'Saving…'
                    : editing
                      ? 'Save changes'
                      : 'Post update'}
              </Text>
            </Pressable>
          </View>
        </View>

      </KeyboardAvoidingView>

      {/* Date picker —
          • Android: render the bare DateTimePicker, which is a system
            modal dialog that auto-dismisses on pick / cancel. No own
            sheet needed.
          • iOS: wrap the picker in a bottom-sheet Modal so it's
            actually visible on top of the composer modal. The user
            scrolls the wheel and taps Done to commit. */}
      {Platform.OS === 'android' && pickingField ? (
        <DateTimePicker
          value={draftPickerDate || new Date()}
          mode="date"
          display="default"
          onChange={onPickerChange}
        />
      ) : null}
      {Platform.OS === 'ios' ? (
        <Modal
          visible={!!pickingField}
          transparent
          animationType="slide"
          onRequestClose={() => setPickingField('')}
        >
          <Pressable
            style={styles.pickerBackdrop}
            onPress={() => setPickingField('')}
          />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerSheetHead}>
              <Pressable
                onPress={() => setPickingField('')}
                hitSlop={8}
              >
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </Pressable>
              <Text style={styles.pickerSheetTitle}>
                {pickingField === 'scheduledAt'
                  ? 'Scheduled date'
                  : 'Next hearing'}
              </Text>
              <Pressable onPress={commitPicker} hitSlop={8}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={draftPickerDate || new Date()}
              mode="date"
              display="spinner"
              onChange={onPickerChange}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        </Modal>
      ) : null}
    </Modal>
  );
}

// Pressable field that looks like an input but launches the native
// date picker on tap. Right-side X clears the value.
function DateField({ value, onPressOpen, onClear, placeholder }) {
  return (
    <Pressable
      onPress={onPressOpen}
      style={({ pressed }) => [
        styles.composerInput,
        styles.dateField,
        { opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <Feather name="calendar" size={14} color={colors.textMuted} />
      <Text
        style={[
          styles.dateFieldText,
          !value && { color: colors.textMuted },
        ]}
      >
        {value || placeholder}
      </Text>
      {value ? (
        <Pressable onPress={onClear} hitSlop={8}>
          <Feather name="x" size={13} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function PillPicker({ options, value, onChange }) {
  return (
    <View style={styles.pillRow}>
      {options.map((opt) => {
        const active = (value || '') === (opt.value || '');
        return (
          <Pressable
            key={opt.value || '__none'}
            onPress={() => onChange(opt.value)}
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
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------
// Shared attachments renderer — images render inline as thumbnails,
// non-images render as paperclip pills. Both open in the device
// browser when tapped (the URL is presigned by the backend).
// ---------------------------------------------------------------------

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|heic|heif|bmp)(\?|$)/i;

// Pretty filename for an attachment, defending against legacy rows
// whose `name` was set to a signed S3 URL (which leaks X-Amz-* query
// params). Drops everything after `?`, strips path segments, falls
// back to a generic label if nothing usable remains.
function prettyAttachmentName(att, index) {
  const candidates = [att && att.name, att && att.url];
  for (const c of candidates) {
    if (!c) continue;
    const s = String(c);
    const noQs = s.split('?')[0];
    const tail = noQs.split('/').pop();
    if (tail && tail.length > 0 && tail.length < 80) return tail;
  }
  return `Attachment ${index + 1}`;
}

function isImageAttachment(att) {
  if (!att) return false;
  if (att.mimeType && String(att.mimeType).startsWith('image/')) return true;
  if (att.mimetype && String(att.mimetype).startsWith('image/')) return true;
  if (att.type && String(att.type).startsWith('image/')) return true;
  const url = String(att.url || att.name || '');
  return IMAGE_EXT_RE.test(url);
}

function AttachmentList({ attachments, keyPrefix, caseId }) {
  if (!Array.isArray(attachments) || attachments.length === 0) return null;
  const images = [];
  const others = [];
  for (const a of attachments) {
    if (isImageAttachment(a)) images.push(a);
    else others.push(a);
  }
  return (
    <View>
      {images.length > 0 ? (
        <View style={styles.imageRow}>
          {images.map((a, i) => (
            <ImageAttachmentThumb
              key={`${keyPrefix}-img-${i}`}
              caseId={caseId}
              attachment={a}
            />
          ))}
        </View>
      ) : null}
      {others.length > 0 ? (
        <View style={styles.attachmentRow}>
          {others.map((a, i) => (
            <FileAttachmentChip
              key={`${keyPrefix}-att-${i}`}
              caseId={caseId}
              attachment={a}
              fallbackName={prettyAttachmentName(a, i)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ImageAttachmentThumb({ caseId, attachment }) {
  const { uri, loading } = useCaseAttachmentUrl(caseId, attachment && attachment.url);
  if (loading) {
    return (
      <View style={[styles.imageThumbWrap, styles.imageThumbPlaceholder]}>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  }
  if (!uri) return null;
  return (
    <Pressable
      onPress={() => Linking.openURL(uri).catch(() => {})}
      style={({ pressed }) => [
        styles.imageThumbWrap,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Image
        source={{ uri }}
        style={styles.imageThumb}
        resizeMode="cover"
      />
    </Pressable>
  );
}

function FileAttachmentChip({ caseId, attachment, fallbackName }) {
  const { uri, loading } = useCaseAttachmentUrl(caseId, attachment && attachment.url);
  return (
    <Pressable
      onPress={() => uri && Linking.openURL(uri).catch(() => {})}
      disabled={loading || !uri}
      style={({ pressed }) => [
        styles.attachmentChip,
        { opacity: pressed || loading ? 0.7 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.textSecondary} size="small" />
      ) : (
        <Feather name="paperclip" size={10} color={colors.textSecondary} />
      )}
      <Text style={styles.attachmentText} numberOfLines={1}>
        {fallbackName}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------
// Notes thread + composer
// ---------------------------------------------------------------------

function NotesCard({
  notes,
  currentUser,
  caseId,
  canEdit,
  noteBody,
  setNoteBody,
  attachments,
  onAttach,
  onRemoveAttach,
  attachUploading,
  submitting,
  error,
  onPost,
  onNotesChanged,
}) {
  const canPost =
    !submitting && (noteBody.trim().length > 0 || attachments.length > 0);
  return (
    <Card>
      <SectionHeader
        icon="message-square"
        label={notes.length > 0 ? `Notes & messages (${notes.length})` : 'Notes & messages'}
      />

      {/* Compose box — at the top so the user can act immediately. */}
      <View style={styles.composerWrap}>
        <TextInput
          value={noteBody}
          onChangeText={setNoteBody}
          placeholder="Write a note for your professional…"
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          style={styles.composerInput}
        />

        {attachments.length > 0 ? (
          <View style={styles.composerAttachList}>
            {attachments.map((a) => (
              <View key={a.url} style={styles.composerAttach}>
                <Feather name="paperclip" size={11} color={colors.primary} />
                <Text
                  style={styles.composerAttachText}
                  numberOfLines={1}
                >
                  {prettyAttachmentName(a, 0)}
                </Text>
                <Pressable
                  onPress={() => onRemoveAttach(a.url)}
                  hitSlop={8}
                  style={styles.composerAttachRemove}
                >
                  <Feather name="x" size={11} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {error ? <Text style={styles.composerError}>{error}</Text> : null}

        <View style={styles.composerActions}>
          <Pressable
            onPress={onAttach}
            disabled={attachUploading || submitting}
            hitSlop={6}
            style={({ pressed }) => [
              styles.attachBtn,
              {
                opacity:
                  pressed || attachUploading || submitting ? 0.6 : 1,
              },
            ]}
          >
            {attachUploading ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Feather name="paperclip" size={13} color={colors.primary} />
            )}
            <Text style={styles.attachBtnText}>
              {attachUploading ? 'Uploading…' : 'Attach'}
            </Text>
          </Pressable>

          <Pressable
            onPress={onPost}
            disabled={!canPost}
            style={({ pressed }) => [
              styles.postBtn,
              { opacity: pressed || !canPost ? 0.6 : 1 },
            ]}
          >
            <LinearGradient
              colors={['#f59e0b', '#d97706']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.postBtnFill}
            >
              {submitting ? (
                <ActivityIndicator color={colors.textInverse} size="small" />
              ) : (
                <Feather name="send" size={13} color={colors.textInverse} />
              )}
              <Text style={styles.postBtnText}>
                {submitting ? 'Posting…' : 'Post note'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      {notes.length === 0 ? (
        <View style={styles.notesEmpty}>
          <Text style={styles.muted}>
            No messages yet. Start the conversation above.
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          {notes.map((n) => (
            <NoteRow
              key={n.id}
              note={n}
              currentUser={currentUser}
              caseId={caseId}
              canEdit={canEdit}
              onNotesChanged={onNotesChanged}
            />
          ))}
        </View>
      )}
    </Card>
  );
}

function NoteRow({ note, currentUser, caseId, canEdit, onNotesChanged }) {
  const author =
    note.authorName ||
    note.userName ||
    (note.user && displayName(note.user)) ||
    note.authorEmail ||
    'Member';
  const photoUrl = imageUrl(
    note.authorPhoto ||
      (note.user && (note.user.profilePhoto || note.user.photo)) ||
      null
  );
  const mine = currentUser && note.userId && note.userId === currentUser.id;
  const when = formatDateTime(note.createdAt || note.date);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(note.body || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const canMutate = canEdit && mine && !!caseId;

  async function saveEdit() {
    const trimmed = editBody.trim();
    if (!trimmed) {
      setErr('Note cannot be empty.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await editCaseNote(caseId, note.id, { body: trimmed });
      setEditing(false);
      onNotesChanged?.();
    } catch (e) {
      setErr(e?.message || 'Could not save the change.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete this note?',
      'The note and its attachments will be removed from this case.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteCaseNote(caseId, note.id);
              onNotesChanged?.();
            } catch (e) {
              Alert.alert('Could not delete', e?.message || 'Try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.noteRow, mine && styles.noteRowMine]}>
      <AvatarWithInitials
        uri={photoUrl}
        name={author}
        size={32}
        style={{ borderRadius: 16 }}
      />
      <View style={{ flex: 1 }}>
        <View style={styles.noteHeadRow}>
          <Text style={styles.noteAuthor} numberOfLines={1}>
            {author}
            {mine ? ' · You' : ''}
          </Text>
          {when ? <Text style={styles.noteWhen}>{when}</Text> : null}
        </View>
        {editing ? (
          <View>
            <TextInput
              value={editBody}
              onChangeText={setEditBody}
              multiline
              textAlignVertical="top"
              style={styles.noteEditInput}
              placeholderTextColor={colors.textMuted}
            />
            {err ? <Text style={styles.composerError}>{err}</Text> : null}
            <View style={styles.noteEditActions}>
              <Pressable
                onPress={() => {
                  setEditing(false);
                  setEditBody(note.body || '');
                  setErr('');
                }}
                disabled={busy}
                style={({ pressed }) => [
                  styles.noteEditBtnGhost,
                  { opacity: busy ? 0.5 : pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.noteEditBtnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveEdit}
                disabled={busy}
                style={({ pressed }) => [
                  styles.noteEditBtnPrimary,
                  { opacity: busy ? 0.55 : pressed ? 0.9 : 1 },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Feather name="check" size={11} color="#ffffff" />
                )}
                <Text style={styles.noteEditBtnPrimaryText}>
                  {busy ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {note.body ? (
              <Text style={styles.noteBody}>{note.body}</Text>
            ) : null}
            <AttachmentList
              attachments={note.attachments}
              keyPrefix={`note-${note.id || ''}`}
              caseId={caseId}
            />
            {canMutate ? (
              <View style={styles.noteActionsRow}>
                <Pressable
                  onPress={() => {
                    setEditBody(note.body || '');
                    setEditing(true);
                  }}
                  hitSlop={6}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.noteActionBtn,
                    { opacity: busy ? 0.5 : pressed ? 0.7 : 1 },
                  ]}
                >
                  <Feather name="edit-2" size={11} color={colors.textSecondary} />
                  <Text style={styles.noteActionText}>Edit</Text>
                </Pressable>
                <Pressable
                  onPress={confirmDelete}
                  hitSlop={6}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.noteActionBtn,
                    { opacity: busy ? 0.5 : pressed ? 0.7 : 1 },
                  ]}
                >
                  <Feather name="trash-2" size={11} color={colors.danger} />
                  <Text style={[styles.noteActionText, { color: colors.danger }]}>
                    Delete
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------
// Activity log — newest first, capped to 30 rows on first paint.
// ---------------------------------------------------------------------

function ActivityLogCard({ entries }) {
  const rows = Array.isArray(entries) ? entries : [];
  return (
    <Card>
      <SectionHeader
        icon="list"
        label={rows.length > 0 ? `Activity log (${rows.length})` : 'Activity log'}
      />
      {rows.length === 0 ? (
        <Text style={styles.muted}>No activity recorded yet.</Text>
      ) : (
        // Internal vertical scroll — keeps a long log from
        // dominating the page while still letting the user reach
        // every entry. `nestedScrollEnabled` is needed on Android so
        // the inner ScrollView can capture pan inside the outer one.
        <ScrollView
          style={styles.logScroll}
          contentContainerStyle={{ gap: 8 }}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {rows.map((entry) => (
            <View key={entry.id} style={styles.logRow}>
              <View style={styles.logBullet} />
              <View style={{ flex: 1 }}>
                <Text style={styles.logLine}>
                  <Text style={styles.logActor}>
                    {entry.actorName ||
                      entry.actor ||
                      (entry.user && (entry.user.fullName || entry.user.name)) ||
                      'System'}
                  </Text>
                  {entry.action ? `  ${entry.action}` : ''}
                </Text>
                {entry.detail || entry.message ? (
                  <Text style={styles.logDetail}>
                    {entry.detail || entry.message}
                  </Text>
                ) : null}
                {entry.createdAt ? (
                  <Text style={styles.logWhen}>
                    {formatDateTime(entry.createdAt)}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------
// Delete-case CTA
// ---------------------------------------------------------------------

function DeleteCaseCard({ onPress, busy }) {
  return (
    <Card style={styles.deleteCard}>
      <Text style={styles.deleteTitle}>Danger zone</Text>
      <Text style={styles.deleteBody}>
        Permanently delete this case. Every note, update, attachment
        and activity-log entry is removed. This can&rsquo;t be undone.
      </Text>
      <Pressable
        onPress={onPress}
        disabled={busy}
        style={({ pressed }) => [
          styles.deleteBtn,
          { opacity: pressed || busy ? 0.6 : 1 },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.danger} size="small" />
        ) : (
          <Feather name="trash-2" size={14} color={colors.danger} />
        )}
        <Text style={styles.deleteBtnText}>
          {busy ? 'Deleting…' : 'Delete case'}
        </Text>
      </Pressable>
    </Card>
  );
}

function LeaveCaseCard({ assigneeCount, onPress }) {
  return (
    <Card style={styles.leaveCard}>
      <View style={styles.leaveHead}>
        <Feather name="log-out" size={13} color="#92400e" />
        <Text style={styles.leaveTitle}>Leave this case</Text>
      </View>
      <Text style={styles.leaveBody}>
        Shared with {Math.max(assigneeCount - 1, 1)} other
        {assigneeCount - 1 === 1 ? '' : 's'}. Leaving keeps the case
        intact for the rest of your team — your notes and updates stay
        behind.
      </Text>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.leaveBtn,
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Feather name="log-out" size={12} color="#92400e" />
        <Text style={styles.leaveBtnText}>Leave case</Text>
      </Pressable>
    </Card>
  );
}

function AiSummaryCard({ summary, updatedAt, onRegenerate }) {
  if (!summary) return null;
  return (
    <Card style={styles.aiSummaryCard}>
      <View style={styles.aiSummaryHead}>
        <View style={styles.aiSummaryIcon}>
          <Feather name="zap" size={12} color="#ffffff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.aiSummaryTitle}>AI Clerk summary</Text>
          {updatedAt ? (
            <Text style={styles.aiSummaryWhen}>
              Updated {formatDateTime(updatedAt)}
            </Text>
          ) : null}
        </View>
        {onRegenerate ? (
          <Pressable
            onPress={onRegenerate}
            hitSlop={6}
            style={({ pressed }) => [
              styles.aiRegenBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Feather name="rotate-cw" size={11} color="#4338ca" />
            <Text style={styles.aiRegenText}>Regenerate</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.aiSummaryBody}>{summary}</Text>
    </Card>
  );
}

function DeleteConfirmModal({
  visible,
  title,
  confirmText,
  onChangeConfirmText,
  error,
  busy,
  onCancel,
  onConfirm,
}) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHead}>
            <Feather name="alert-triangle" size={14} color={colors.danger} />
            <Text style={styles.modalTitle}>Delete case</Text>
          </View>
          <Text style={styles.modalBody}>
            This permanently deletes &ldquo;{title || 'this case'}&rdquo;.
            Notes, updates, attachments and the activity log will all be
            removed. This cannot be undone.
          </Text>
          <Text style={styles.modalHint}>
            Type <Text style={styles.modalHintMono}>delete</Text> below to
            confirm.
          </Text>
          <TextInput
            value={confirmText}
            onChangeText={onChangeConfirmText}
            placeholder="delete"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.modalInput}
          />
          {error ? <Text style={styles.composerError}>{error}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={({ pressed }) => [
                styles.modalCancelBtn,
                { opacity: busy ? 0.5 : pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={
                busy || (confirmText || '').trim().toLowerCase() !== 'delete'
              }
              style={({ pressed }) => [
                styles.modalDangerBtn,
                {
                  opacity:
                    busy ||
                    (confirmText || '').trim().toLowerCase() !== 'delete'
                      ? 0.5
                      : pressed
                        ? 0.85
                        : 1,
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Feather name="trash-2" size={12} color="#ffffff" />
              )}
              <Text style={styles.modalDangerText}>
                {busy ? 'Deleting…' : 'Delete case'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function LeaveConfirmModal({ visible, busy, error, onCancel, onConfirm }) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHead}>
            <Feather name="log-out" size={14} color="#92400e" />
            <Text style={styles.modalTitle}>Leave this case</Text>
          </View>
          <Text style={styles.modalBody}>
            Other professionals in your firm will continue to work on it.
            Your notes and updates stay attached — you can be added back
            at any time.
          </Text>
          {error ? <Text style={styles.composerError}>{error}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={({ pressed }) => [
                styles.modalCancelBtn,
                { opacity: busy ? 0.5 : pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={busy}
              style={({ pressed }) => [
                styles.modalAmberBtn,
                { opacity: busy ? 0.55 : pressed ? 0.85 : 1 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Feather name="log-out" size={12} color="#ffffff" />
              )}
              <Text style={styles.modalAmberText}>
                {busy ? 'Leaving…' : 'Leave case'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EditCaseModal({ visible, caseRow, onCancel, onSave }) {
  const [form, setForm] = useState(() => seedEditForm(caseRow));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setForm(seedEditForm(caseRow));
      setError('');
    }
  }, [visible, caseRow]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (busy) return;
    const title = (form.title || '').trim();
    if (!title) {
      setError('Title is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave({
        title,
        category: form.category || null,
        description: form.description || null,
        priority: form.priority || null,
        caseNumber: form.caseNumber || null,
        cnr: form.cnr || null,
        courtName: form.courtName || null,
        opposingParty: form.opposingParty || null,
      });
    } catch (e) {
      setError(e?.message || 'Could not save the case.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { maxHeight: '88%' }]}>
          <View style={styles.modalHead}>
            <Feather name="edit-2" size={14} color={colors.primary} />
            <Text style={styles.modalTitle}>Edit case</Text>
          </View>
          <ScrollView
            style={{ maxHeight: '78%' }}
            contentContainerStyle={{ gap: spacing.sm }}
            keyboardShouldPersistTaps="handled"
          >
            <EditField
              label="Title"
              value={form.title}
              onChangeText={(v) => set('title', v)}
              required
            />
            <EditField
              label="Category"
              value={form.category}
              onChangeText={(v) => set('category', v)}
              placeholder="e.g. Civil, Tax, GST"
            />
            <EditField
              label="Priority"
              value={form.priority}
              onChangeText={(v) => set('priority', v)}
              placeholder="low / medium / high / urgent"
            />
            <EditField
              label="Case number"
              value={form.caseNumber}
              onChangeText={(v) => set('caseNumber', v)}
            />
            <EditField
              label="CNR"
              value={form.cnr}
              onChangeText={(v) => set('cnr', v)}
              autoCapitalize="characters"
            />
            <EditField
              label="Court name"
              value={form.courtName}
              onChangeText={(v) => set('courtName', v)}
            />
            <EditField
              label="Opposing party"
              value={form.opposingParty}
              onChangeText={(v) => set('opposingParty', v)}
            />
            <EditField
              label="Description"
              value={form.description}
              onChangeText={(v) => set('description', v)}
              multiline
            />
          </ScrollView>
          {error ? <Text style={styles.composerError}>{error}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={({ pressed }) => [
                styles.modalCancelBtn,
                { opacity: busy ? 0.5 : pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={busy}
              style={({ pressed }) => [
                styles.modalPrimaryBtn,
                { opacity: busy ? 0.6 : pressed ? 0.9 : 1 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Feather name="check" size={12} color="#ffffff" />
              )}
              <Text style={styles.modalPrimaryText}>
                {busy ? 'Saving…' : 'Save changes'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EditField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  required,
  autoCapitalize,
}) {
  return (
    <View>
      <Text style={styles.editFieldLabel}>
        {label}
        {required ? <Text style={styles.requiredStar}> *</Text> : null}
      </Text>
      <TextInput
        value={value || ''}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={!!multiline}
        textAlignVertical={multiline ? 'top' : 'auto'}
        autoCapitalize={autoCapitalize || 'sentences'}
        autoCorrect={false}
        style={[styles.editFieldInput, multiline ? styles.editFieldMulti : null]}
      />
    </View>
  );
}

function seedEditForm(c) {
  if (!c) {
    return {
      title: '',
      category: '',
      description: '',
      priority: '',
      caseNumber: '',
      cnr: '',
      courtName: '',
      opposingParty: '',
    };
  }
  return {
    title: c.title || '',
    category: c.category || '',
    description: c.description || '',
    priority: c.priority || '',
    caseNumber: c.caseNumber || '',
    cnr: c.cnr || '',
    courtName: c.courtName || '',
    opposingParty: c.opposingParty || '',
  };
}

// ---------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------

function SectionHeader({ icon, label }) {
  return (
    <View style={styles.sectionHeader}>
      <Feather name={icon} size={14} color={colors.primary} />
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Card-to-card breathing room — mirrors the web's `space-y-6`.
  contentStack: { gap: spacing.lg },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: 0.1,
  },

  // Header card
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  badgeRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cnrChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  cnrText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#92400e',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cnrTextMono: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: '#92400e',
    fontFamily: 'Courier',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  refreshText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },

  // Clients
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clientName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  clientMeta: {
    marginTop: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  metaText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
    maxWidth: 160,
  },

  // Details grid
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detailItem: {
    width: '50%',
    paddingRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  detailValue: {
    marginTop: 3,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  assignedBlock: {
    marginTop: 4,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  assignedRow: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  proChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  proChipText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: '#1d4ed8',
    maxWidth: 160,
  },
  descriptionBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  descriptionText: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },

  // Updates
  updatesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  addUpdateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  addUpdateText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
  updateActions: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  updateActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  updateActionText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  updateDangerBtn: {
    borderColor: colors.danger,
    backgroundColor: '#fff5f5',
  },
  updateDangerText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.danger,
  },

  // Composer modal
  composerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  composerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  composerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  composerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  composerField: { gap: 4 },
  composerLabel: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  composerInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  composerTextarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },

  attachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  attachBtnText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  attachHint: { fontSize: 11, color: colors.textMuted },
  attachList: { gap: 6, marginTop: 6 },
  attachItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  attachItemName: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
  },

  composerActions: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  composerCancel: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  composerCancelText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  composerSave: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  composerSaveDisabled: {
    backgroundColor: colors.textMuted,
  },
  composerSaveText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },

  // Date-picker trigger field — looks like an input row.
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateFieldText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  // iOS date-picker bottom sheet.
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  pickerSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  pickerSheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerSheetTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  pickerCancelText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  pickerDoneText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },

  updateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  updateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  updateHeadRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  updateTitle: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  updateWhen: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
  },
  updateBody: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  hearingPill: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  hearingText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#92400e',
  },

  // Notes
  composerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  composerInput: {
    minHeight: 72,
    maxHeight: 200,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    paddingTop: 4,
    paddingHorizontal: 4,
  },
  composerActions: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  composerError: {
    marginTop: 4,
    fontSize: 11,
    color: colors.danger,
  },
  composerAttachList: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  composerAttach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.35)',
    maxWidth: 220,
  },
  composerAttachText: {
    flex: 1,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.primarySoftText,
  },
  composerAttachRemove: { padding: 1 },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  attachBtnText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  postBtn: { borderRadius: radius.pill, overflow: 'hidden' },
  postBtnFill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  postBtnText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.2,
  },
  notesEmpty: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  noteRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteRowMine: {
    backgroundColor: '#fff7e6',
    borderColor: '#fcd34d',
  },
  noteHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  noteAuthor: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  noteWhen: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
  },
  noteBody: {
    marginTop: 3,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 19,
  },

  // Attachments (shared by notes + updates)
  attachmentRow: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  // Inline image thumbnails for image-type attachments.
  imageRow: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  imageThumbWrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  imageThumb: {
    width: 120,
    height: 120,
  },
  imageThumbPlaceholder: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attachmentText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
    maxWidth: 160,
  },

  muted: { color: colors.textSecondary, fontSize: fontSize.sm },

  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  inlineErrorText: {
    flex: 1,
    fontSize: 11,
    color: colors.danger,
    fontWeight: fontWeight.semibold,
  },

  // Activity log — internal scroll, capped at ~280px so it doesn't
  // push the delete CTA below the fold on cases with long histories.
  logScroll: {
    maxHeight: 280,
  },
  logRow: {
    flexDirection: 'row',
    gap: 10,
  },
  logBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
    marginTop: 7,
  },
  logLine: { fontSize: 12, color: colors.textPrimary, lineHeight: 18 },
  logActor: { fontWeight: fontWeight.bold, color: colors.textPrimary },
  logDetail: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  logWhen: {
    marginTop: 3,
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
  },

  // Delete CTA — danger styled so it reads as destructive without
  // shouting at the user the moment they open the case.
  deleteCard: {
    borderColor: '#fecaca',
  },
  deleteTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.danger,
  },
  deleteBody: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  deleteBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: '#fee2e2',
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.danger,
    letterSpacing: 0.2,
  },

  // Header action button row (Refresh / Sync / Edit).
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  headerActionBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  headerActionText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  headerActionTextPrimary: { color: '#ffffff' },

  // Note actions
  noteActionsRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  noteActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  noteActionText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  noteEditInput: {
    minHeight: 60,
    maxHeight: 200,
    marginTop: 6,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  noteEditActions: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  noteEditBtnGhost: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  noteEditBtnGhostText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  noteEditBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  noteEditBtnPrimaryText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },

  // AI Summary card
  aiSummaryCard: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  aiSummaryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  aiSummaryIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiSummaryTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#312e81',
  },
  aiSummaryWhen: { marginTop: 1, fontSize: 10, color: '#4338ca' },
  aiRegenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  aiRegenText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#4338ca',
  },
  aiSummaryBody: {
    fontSize: 13,
    color: '#312e81',
    lineHeight: 19,
  },

  // Leave card
  leaveCard: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  leaveHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  leaveTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#92400e',
  },
  leaveBody: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 17,
    marginBottom: spacing.sm,
  },
  leaveBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#92400e',
    backgroundColor: '#fef3c7',
  },
  leaveBtnText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: '#92400e',
  },

  // Floating AI button
  aiFab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#4f46e5',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  aiFabText: {
    fontSize: 13,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    letterSpacing: 0.3,
  },

  // Modals (delete / leave / edit)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  modalBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  modalHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  modalHintMono: {
    fontFamily: 'Courier',
    color: colors.textPrimary,
    fontWeight: fontWeight.bold,
  },
  modalInput: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  modalActions: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalCancelText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  modalDangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
  },
  modalDangerText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  modalAmberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: '#b45309',
  },
  modalAmberText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  modalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  modalPrimaryText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },

  // Edit case form fields
  editFieldLabel: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  requiredStar: { color: colors.danger },
  editFieldInput: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  editFieldMulti: { minHeight: 80, maxHeight: 200 },

  // Update composer — task fields panel
  taskPanel: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    gap: 6,
  },
  taskPanelTitle: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
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

  // Update task badges
  updateMetaRow: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  duePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#dbeafe',
  },
  dueText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#1e40af',
  },
  taskBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  taskBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
