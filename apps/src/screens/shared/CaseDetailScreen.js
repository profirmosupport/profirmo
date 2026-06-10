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
  Linking,
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
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import AvatarWithInitials from '../../components/common/AvatarWithInitials';
import {
  addCaseNote,
  deleteCase,
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

      <UpdatesCard updates={updates} loadError={updatesError} />

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

function UpdatesCard({ updates, loadError }) {
  return (
    <Card>
      <SectionHeader
        icon="calendar"
        label={updates.length > 0 ? `Case updates (${updates.length})` : 'Case updates'}
      />
      {loadError ? (
        <View style={styles.inlineError}>
          <Feather name="alert-circle" size={13} color={colors.danger} />
          <Text style={styles.inlineErrorText}>{loadError}</Text>
        </View>
      ) : null}
      {updates.length === 0 ? (
        <Text style={styles.muted}>
          Your professional&apos;s scheduled updates and hearing notes will
          appear here.
        </Text>
      ) : (
        <View style={{ gap: spacing.md }}>
          {updates.slice(0, 8).map((u) => (
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
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------
// Shared attachments renderer — images render inline as thumbnails,
// non-images render as paperclip pills. Both open in the device
// browser when tapped (the URL is presigned by the backend).
// ---------------------------------------------------------------------

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|heic|heif|bmp)(\?|$)/i;
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
            const fallbackName =
              a.name ||
              (a.url ? String(a.url).split('/').pop() : 'Attachment');
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
                  {a.name}
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
                    {entry.actor || 'System'}
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
