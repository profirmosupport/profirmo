// BookingDetailScreen — mobile mirror of the web's
// /dashboard/client/bookings/[id] page (frontend/components/booking/
// BookingDetailView.js).
//
// Sections, top → bottom:
//   1. Counterparty card    — avatar + name + designation + Connect chips
//   2. Booking summary card — when / duration / amount / escrow + status pill
//   3. Notes card           — message thread + composer with attach
//
// Pulls the rich detail from /api/bookings/:id/detail (same endpoint
// the web uses). On error or while loading we show a tight inline state
// instead of an empty page.

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
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
  addBookingNote,
  getBookingDetail,
} from '../../services/bookingService';
import { uploadFile } from '../../services/uploadService';
import { useAuth } from '../../contexts/AuthContext';
import { displayName, formatDate, formatRupees } from '../../utils/formatters';
import { imageUrl } from '../../utils/imageUrl';
import { ROLES } from '../../config/constants';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const STATUS_VARIANT = {
  pending: 'amber',
  confirmed: 'amber',
  completed: 'gray',
  cancelled: 'gray',
};

const ESCROW_LABEL = {
  escrowed: 'Held in escrow',
  awaiting_review: 'Awaiting your review',
  ready_to_release: 'Ready to release',
  payout_requested: 'Payout requested',
  released: 'Released',
  withdrawn: 'Withdrawn',
  refunded: 'Refunded',
};

function formatTime12h(value) {
  if (!value) return '';
  const [hStr, mStr] = String(value).split(':');
  const h = Number(hStr);
  const m = Number(mStr || 0);
  if (!Number.isFinite(h)) return value;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

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

export default function BookingDetailScreen({ route }) {
  const { bookingId } = route.params || {};
  const { user } = useAuth();
  const viewerIsClient = user && user.role === ROLES.CLIENT;

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Composer state.
  const [noteBody, setNoteBody] = useState('');
  const [noteAttachments, setNoteAttachments] = useState([]);
  const [attachUploading, setAttachUploading] = useState(false);
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteError, setNoteError] = useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      if (!bookingId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const data = await getBookingDetail(bookingId);
        setDetail(data || null);
      } catch (err) {
        setError(err?.message || 'Failed to load booking.');
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [bookingId]
  );

  useEffect(() => {
    load(false);
  }, [load]);

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
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      const asset = result.assets[0];
      setAttachUploading(true);
      // Booking notes are scoped to the booking itself — no case
      // required. When the booking later converts to a case, the
      // convertBookingToCase controller copies the note + attachments
      // onto the new CaseNote rows, preserving the timeline.
      const uploaded = await uploadFile({
        uri: asset.uri,
        name: asset.fileName || `note-${Date.now()}.jpg`,
        type: asset.mimeType,
        category: 'booking_note',
        bookingId,
      });
      const url =
        uploaded && (uploaded.url || uploaded.publicUrl || uploaded.path);
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
      await addBookingNote(bookingId, { body, attachments: noteAttachments });
      setNoteBody('');
      setNoteAttachments([]);
      // Re-fetch the detail so the new note appears + permissions
      // refresh.
      await load(true);
    } catch (err) {
      setNoteError(err?.message || 'Could not post the note.');
    } finally {
      setNoteSubmitting(false);
    }
  }

  if (loading && !detail) {
    return (
      <ScreenContainer hasNavHeader>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (error && !detail) {
    return (
      <ScreenContainer hasNavHeader>
        <EmptyState
          icon="alert-circle"
          title="Could not load booking"
          description={error}
        />
      </ScreenContainer>
    );
  }

  if (!detail || !detail.booking) {
    return (
      <ScreenContainer hasNavHeader>
        <EmptyState
          icon="calendar"
          title="Booking not found"
          description="This booking may have been cancelled or removed."
        />
      </ScreenContainer>
    );
  }

  const { booking, professional, client, payment, escrow, notes = [], permissions = {} } = detail;
  const counterparty = viewerIsClient ? professional : client;
  const counterpartyLabel = viewerIsClient ? 'Professional' : 'Client';

  return (
    <ScreenContainer
      hasNavHeader
      keyboard
      refreshing={refreshing}
      onRefresh={() => load(true)}
      contentStyle={styles.contentStack}
    >
      <CounterpartyCard
        person={counterparty}
        label={counterpartyLabel}
        bookingId={booking.id}
        // Contact channels are gated until the booking is confirmed
        // so guests / unpaid bookings don't expose a pro's direct
        // phone or email before the consultation is live.
        showConnect={
          String(booking.status || '').toLowerCase() === 'confirmed'
        }
      />

      <SummaryCard booking={booking} payment={payment} escrow={escrow} />

      <NotesCard
        notes={notes}
        currentUser={user}
        canAdd={!!permissions.canAddNote}
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
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// Counterparty card
// ---------------------------------------------------------------------

function CounterpartyCard({ person, label, bookingId, showConnect }) {
  if (!person) {
    return (
      <Card>
        <Text style={styles.muted}>No {label.toLowerCase()} on this booking.</Text>
      </Card>
    );
  }
  const photoUrl = imageUrl(person.profilePhoto);
  const subtitle = person.designation || person.professionalType || '';
  const shortId = bookingId ? bookingId.slice(-8) : '';
  return (
    <Card>
      <View style={styles.cpHead}>
        <AvatarWithInitials
          uri={photoUrl}
          name={person.name || label}
          size={56}
          style={{ borderRadius: 28 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.cpLabel}>{label}</Text>
          <Text style={styles.cpName} numberOfLines={2}>
            {person.name || '—'}
          </Text>
          {subtitle ? (
            <Text style={styles.cpSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {showConnect ? (
        <View style={styles.connectRow}>
          {person.phone ? (
            <ConnectChip
              icon="phone"
              label="Call"
              onPress={() =>
                Linking.openURL(`tel:${person.phone}`).catch(() => {})
              }
            />
          ) : null}
          {person.phone ? (
            <ConnectChip
              icon="message-circle"
              label="WhatsApp"
              onPress={() =>
                Linking.openURL(
                  `https://wa.me/${String(person.phone).replace(/\D+/g, '')}?text=${encodeURIComponent(
                    `Hi ${person.name || ''}, this is about Profirmo booking ${shortId}.`
                  )}`
                ).catch(() => {})
              }
            />
          ) : null}
          {person.email ? (
            <ConnectChip
              icon="mail"
              label="Email"
              onPress={() =>
                Linking.openURL(
                  `mailto:${person.email}?subject=${encodeURIComponent(
                    `Profirmo booking ${shortId}`
                  )}`
                ).catch(() => {})
              }
            />
          ) : null}
          {!person.phone && !person.email ? (
            <Text style={styles.connectEmpty}>No contact info on file.</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.connectLockedPill}>
          <Feather name="lock" size={11} color={colors.textMuted} />
          <Text style={styles.connectLockedText}>
            Contact details unlock once the booking is confirmed
          </Text>
        </View>
      )}
    </Card>
  );
}

function ConnectChip({ icon, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.connectChip,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Feather name={icon} size={12} color={colors.primary} />
      <Text style={styles.connectChipText}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------

function SummaryCard({ booking, payment, escrow }) {
  const status = String(booking.status || 'pending').toLowerCase();
  const isInstant = String(booking.type || '').toLowerCase() === 'instant';
  const whenLabel = isInstant
    ? 'Instant — Now'
    : booking.date
      ? `${formatDate(booking.date)}${booking.time ? ` · ${formatTime12h(booking.time)}` : ''}`
      : '—';
  return (
    <Card>
      <View style={styles.summaryHead}>
        <Text style={styles.cardTitle}>Booking summary</Text>
        <Badge variant={STATUS_VARIANT[status] || 'gray'}>{status}</Badge>
      </View>
      <View style={styles.detailGrid}>
        <Field label="When" value={whenLabel} />
        <Field
          label="Duration"
          value={booking.duration ? `${booking.duration} min` : '—'}
        />
        <Field
          label="Type"
          value={booking.type ? String(booking.type) : '—'}
        />
        {payment ? (
          <Field
            label="Amount paid"
            value={payment.amount ? formatRupees(payment.amount) : '—'}
          />
        ) : null}
        {escrow ? (
          <Field
            label="Escrow"
            value={ESCROW_LABEL[escrow.status] || escrow.status}
          />
        ) : null}
        <Field
          label="Booking ID"
          value={booking.id ? `#${String(booking.id).slice(-8)}` : '—'}
        />
      </View>
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
// Notes card
// ---------------------------------------------------------------------

function NotesCard({
  notes,
  currentUser,
  canAdd,
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
      <View style={styles.sectionHeader}>
        <Feather name="message-square" size={14} color={colors.primary} />
        <Text style={styles.cardTitle}>
          Notes &amp; messages
          {notes.length > 0 ? ` (${notes.length})` : ''}
        </Text>
      </View>

      {canAdd ? (
        <View style={styles.composerWrap}>
          <TextInput
            value={noteBody}
            onChangeText={setNoteBody}
            placeholder="Anything you want to share about this booking…"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            style={styles.composerInput}
          />

          {attachments.length > 0 ? (
            <View style={styles.attachList}>
              {attachments.map((a) => (
                <View key={a.url} style={styles.attachChip}>
                  <Feather name="paperclip" size={11} color={colors.primary} />
                  <Text style={styles.attachChipText} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Pressable
                    onPress={() => onRemoveAttach(a.url)}
                    hitSlop={8}
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
      ) : null}

      {notes.length === 0 ? (
        <Text style={styles.muted}>
          {canAdd
            ? 'No messages yet. Add the first one above.'
            : 'No messages yet for this booking.'}
        </Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
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
    (note.user && displayName(note.user)) ||
    note.authorRole ||
    'Member';
  const role = note.authorRole;
  const mine =
    currentUser && note.userId && note.userId === currentUser.id;
  const photoUrl = imageUrl(
    note.authorPhoto ||
      (note.user && (note.user.profilePhoto || note.user.photo)) ||
      null
  );
  const when = formatDateTime(note.createdAt);
  return (
    <View style={[styles.noteRow, mine && styles.noteRowMine]}>
      <AvatarWithInitials
        uri={photoUrl}
        name={author}
        size={32}
        style={{ borderRadius: 16 }}
      />
      <View style={{ flex: 1 }}>
        <View style={styles.noteHead}>
          <Text style={styles.noteAuthor} numberOfLines={1}>
            {author}
            {mine ? ' · You' : ''}
          </Text>
          {role ? (
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>{role}</Text>
            </View>
          ) : null}
        </View>
        {when ? <Text style={styles.noteWhen}>{when}</Text> : null}
        {note.body ? <Text style={styles.noteBody}>{note.body}</Text> : null}
        {Array.isArray(note.attachments) && note.attachments.length > 0 ? (
          <View style={styles.attachList}>
            {note.attachments.map((a, i) => (
              <View key={`note-att-${i}`} style={styles.attachChip}>
                <Feather name="paperclip" size={10} color={colors.textSecondary} />
                <Text style={styles.attachChipText} numberOfLines={1}>
                  {a.name ||
                    (a.url
                      ? String(a.url).split('/').pop()
                      : 'attachment')}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contentStack: { gap: spacing.lg },

  muted: { color: colors.textSecondary, fontSize: fontSize.sm },

  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: 0.1,
  },

  // Counterparty
  cpHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cpLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cpName: {
    marginTop: 2,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  cpSubtitle: {
    marginTop: 2,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  connectRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  connectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  connectChipText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  connectEmpty: {
    fontSize: 11,
    color: colors.textMuted,
  },
  connectLockedPill: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  connectLockedText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
  },

  // Summary
  summaryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
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

  // Notes
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
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
  attachList: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  attachChip: {
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
  attachChipText: {
    flex: 1,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.primarySoftText,
  },
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
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  postBtnText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.2,
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
  noteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteAuthor: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  rolePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rolePillText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  noteWhen: {
    marginTop: 2,
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
  },
  noteBody: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 19,
  },
});
