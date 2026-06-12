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
  deleteCaseUpdate,
  editCaseUpdate,
  getCase,
  listCaseLog,
  listCaseNotes,
  listCaseUpdates,
} from '../../services/caseService';
import { uploadFile } from '../../services/uploadService';
import { useAuth } from '../../contexts/AuthContext';
import { displayName, formatDate } from '../../utils/formatters';
import { imageUrl } from '../../utils/imageUrl';
import { ROLES } from '../../config/constants';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

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

  // Delete-case flow state.
  const [deleting, setDeleting] = useState(false);

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

  // --- Delete case (client + no professional assigned) ----------------

  // Whether the user is allowed to delete this case from here. Backend
  // enforces the same rule, but we mirror it client-side so the button
  // only shows when it would actually work.
  function caseHasProfessional(c) {
    if (!c) return false;
    if (c.professionalId) return true;
    if (Array.isArray(c.professionalIds) && c.professionalIds.length > 0) {
      return true;
    }
    return false;
  }
  const canDelete =
    isClient && item && !caseHasProfessional(item);

  function confirmDelete() {
    Alert.alert(
      'Delete this case?',
      'This permanently removes the case from your dashboard. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: handleDelete,
        },
      ]
    );
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteCase(caseId);
      // Back out of the case detail. The list screen reloads on
      // focus, so the deleted row drops off automatically.
      navigation.goBack?.();
    } catch (err) {
      Alert.alert(
        'Could not delete',
        err?.message || 'Something went wrong while deleting the case.'
      );
    } finally {
      setDeleting(false);
    }
  }

  // --- Header CTA: refresh OR open in eCourts --------------------------

  function handleHeaderCta() {
    // For cases imported from eCourts, route the user to the live
    // eCourts case detail screen (richer source-of-truth view, plus
    // the order downloads). For all other cases the same button just
    // re-fetches the local data.
    if (item && item.source === 'ecourts' && item.cnr) {
      try {
        navigation.navigate('ECourtsCaseDetail', { cnr: item.cnr });
        return;
      } catch {}
    }
    load(true);
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

  const ecourtsLinked = item.source === 'ecourts' && Boolean(item.cnr);

  return (
    <ScreenContainer
      hasNavHeader
      keyboard
      refreshing={refreshing}
      onRefresh={() => load(true)}
      contentStyle={styles.contentStack}
    >
      <HeaderCard
        item={item}
        onAction={handleHeaderCta}
        refreshing={refreshing}
        ecourtsLinked={ecourtsLinked}
      />

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
          // Refresh updates + log after any add / edit / delete.
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
        noteBody={noteBody}
        setNoteBody={setNoteBody}
        attachments={noteAttachments}
        onAttach={handleAttach}
        onRemoveAttach={removeAttachment}
        attachUploading={attachUploading}
        submitting={noteSubmitting}
        error={noteError}
        onPost={handlePostNote}
      />

      {/* Activity log lives at the bottom — least frequently looked
          at, longest as the case progresses. Internal scroll keeps a
          long log from dominating the page. */}
      <ActivityLogCard entries={log} />

      {/* Client delete CTA — only when there's no professional yet.
          Backend enforces the same rule; this is just gating the UI
          so the button doesn't show when it would 403. */}
      {canDelete ? (
        <DeleteCaseCard onPress={confirmDelete} busy={deleting} />
      ) : null}
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// Header card — title + badges + refresh
// ---------------------------------------------------------------------

function HeaderCard({ item, onAction, refreshing, ecourtsLinked }) {
  const statusKey = String(item.status || 'open').toLowerCase();
  const priorityKey = String(item.priority || 'medium').toLowerCase();
  return (
    <Card>
      <View style={styles.headerRow}>
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
        <Pressable
          onPress={onAction}
          disabled={refreshing}
          hitSlop={8}
          style={({ pressed }) => [
            styles.refreshBtn,
            { opacity: pressed || refreshing ? 0.6 : 1 },
          ]}
        >
          <Feather
            name={ecourtsLinked ? 'external-link' : 'refresh-cw'}
            size={14}
            color={colors.primary}
          />
          <Text style={styles.refreshText}>
            {ecourtsLinked ? 'eCourts details' : 'Refresh'}
          </Text>
        </Pressable>
      </View>
    </Card>
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
                  {u.nextHearingDate ? (
                    <View style={styles.hearingPill}>
                      <Feather name="calendar" size={10} color="#92400e" />
                      <Text style={styles.hearingText}>
                        Next hearing {formatDate(u.nextHearingDate)}
                      </Text>
                    </View>
                  ) : null}
                  <AttachmentList
                    attachments={u.attachments}
                    keyPrefix={u.id}
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
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Tracks which date field has the native picker open: '' | 'scheduledAt'
  // | 'nextHearingDate'. iOS shows the picker inline; Android shows it as
  // a system dialog that auto-dismisses on pick.
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
      setAttachments(
        Array.isArray(editing.attachments) ? editing.attachments : []
      );
    } else {
      setTitle('');
      setBody('');
      setScheduledAt('');
      setNextHearingDate('');
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
        : nextHearingDate;
    setDraftPickerDate(seed ? new Date(seed) : new Date());
    // Defer the open by a frame so the keyboard-dismiss animation
    // doesn't fight the picker's slide-in.
    setTimeout(() => setPickingField(field), 50);
  }

  function commitPicker() {
    if (!pickingField || !draftPickerDate) {
      setPickingField('');
      return;
    }
    const iso = draftPickerDate.toISOString().slice(0, 10);
    if (pickingField === 'scheduledAt') setScheduledAt(iso);
    else setNextHearingDate(iso);
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
        const iso = picked.toISOString().slice(0, 10);
        if (pickingField === 'scheduledAt') setScheduledAt(iso);
        else setNextHearingDate(iso);
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

function AttachmentList({ attachments, keyPrefix }) {
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
          {images.map((a, i) => {
            const uri = imageUrl(a.url);
            if (!uri) return null;
            return (
              <Pressable
                key={`${keyPrefix}-img-${i}`}
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
          })}
        </View>
      ) : null}
      {others.length > 0 ? (
        <View style={styles.attachmentRow}>
          {others.map((a, i) => {
            const uri = imageUrl(a.url);
            const fallbackName = prettyAttachmentName(a, i);
            return (
              <Pressable
                key={`${keyPrefix}-att-${i}`}
                onPress={() => uri && Linking.openURL(uri).catch(() => {})}
                style={({ pressed }) => [
                  styles.attachmentChip,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Feather
                  name="paperclip"
                  size={10}
                  color={colors.textSecondary}
                />
                <Text
                  style={styles.attachmentText}
                  numberOfLines={1}
                >
                  {fallbackName}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------
// Notes thread + composer
// ---------------------------------------------------------------------

function NotesCard({
  notes,
  currentUser,
  noteBody,
  setNoteBody,
  attachments,
  onAttach,
  onRemoveAttach,
  attachUploading,
  submitting,
  error,
  onPost,
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
            <NoteRow key={n.id} note={n} currentUser={currentUser} />
          ))}
        </View>
      )}
    </Card>
  );
}

function NoteRow({ note, currentUser }) {
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
        {note.body ? (
          <Text style={styles.noteBody}>{note.body}</Text>
        ) : null}
        <AttachmentList
          attachments={note.attachments}
          keyPrefix={`note-${note.id || ''}`}
        />
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
      <Text style={styles.deleteTitle}>Delete this case</Text>
      <Text style={styles.deleteBody}>
        Removes the case from your dashboard. Only available before a
        professional is assigned.
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
});
