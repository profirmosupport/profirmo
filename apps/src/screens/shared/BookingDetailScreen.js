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
  Image,
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
  convertBookingToCase,
  getBookingDetail,
} from '../../services/bookingService';
import { createReview } from '../../services/reviewService';
import { uploadFile } from '../../services/uploadService';
import { useAuth } from '../../contexts/AuthContext';
import {
  displayName,
  formatDate,
  formatINR,
} from '../../utils/formatters';
import { formatSlotLabel } from '../../utils/availability';
import { imageUrl } from '../../utils/imageUrl';
import { INSTANT_BOOKING_MULTIPLIER, ROLES } from '../../config/constants';
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

// Detect an image attachment from its URL / mime / name. Used to
// decide whether to render an inline thumbnail or a paperclip pill.
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|heic|heif|bmp)(\?|$)/i;
function isImageAttachment(att) {
  if (!att) return false;
  if (att.mimeType && String(att.mimeType).startsWith('image/')) return true;
  if (att.mimetype && String(att.mimetype).startsWith('image/')) return true;
  if (att.type && String(att.type).startsWith('image/')) return true;
  const url = String(att.url || att.name || '');
  return IMAGE_EXT_RE.test(url);
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

export default function BookingDetailScreen({ navigation, route }) {
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

  // Convert-to-case state — collapsed CTA expands into an inline form.
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertTitle, setConvertTitle] = useState('');
  const [convertDescription, setConvertDescription] = useState('');
  const [convertSubmitting, setConvertSubmitting] = useState(false);
  const [convertError, setConvertError] = useState('');

  // Review submission state — keyed by review kind so multiple forms
  // (consultation / professional) can submit independently without
  // stomping each other's spinners or errors.
  const [reviewSubmitting, setReviewSubmitting] = useState({});
  const [reviewErrors, setReviewErrors] = useState({});

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

  // BookingDetail + CaseDetail live in the same AccountStack (see
  // navigation/GuestTabs.js), so a direct navigate keeps us in-stack —
  // no cross-tab dance needed.
  function openCaseDetail(caseId) {
    if (!caseId) return;
    navigation.navigate('CaseDetail', { caseId });
  }

  async function handleConvert() {
    if (convertSubmitting) return;
    setConvertError('');
    setConvertSubmitting(true);
    try {
      const result = await convertBookingToCase(bookingId, {
        title: convertTitle.trim() || undefined,
        description: convertDescription.trim() || undefined,
      });
      const caseId = result && result.case && result.case.id;
      setConvertOpen(false);
      setConvertTitle('');
      setConvertDescription('');
      await load(true);
      if (caseId) openCaseDetail(caseId);
    } catch (err) {
      setConvertError(err?.message || 'Could not convert to a case.');
    } finally {
      setConvertSubmitting(false);
    }
  }

  // `kind` is 'consultation' or 'professional'. `reviewedUserId` is
  // omitted for 'professional' (the pro is identified by professionalId
  // on the booking); the backend resolves the consultation reviewee
  // server-side when omitted.
  async function handleSubmitReview(kind, { rating, comment }) {
    if (!rating || reviewSubmitting[kind]) return;
    const booking = detail && detail.booking;
    if (!booking) return;
    setReviewErrors((m) => ({ ...m, [kind]: undefined }));
    setReviewSubmitting((m) => ({ ...m, [kind]: true }));
    try {
      await createReview({
        kind,
        professionalId: booking.professionalId,
        bookingId: booking.id,
        rating,
        comment: comment && comment.trim() ? comment.trim() : undefined,
      });
      await load(true);
    } catch (err) {
      setReviewErrors((m) => ({
        ...m,
        [kind]: err?.message || 'Could not submit the review.',
      }));
    } finally {
      setReviewSubmitting((m) => ({ ...m, [kind]: false }));
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

  const {
    booking,
    professional,
    client,
    payment,
    escrow,
    notes = [],
    permissions = {},
    reviews = {},
    linkedCase,
  } = detail;
  const counterparty = viewerIsClient ? professional : client;
  const counterpartyLabel = viewerIsClient ? 'Professional' : 'Client';
  const isCompleted = String(booking.status || '').toLowerCase() === 'completed';

  const paymentStatus =
    (payment && payment.status) || (payment ? 'created' : null);
  // For the Summary card's Amount-paid vs Amount-due split.
  const isPaymentPending =
    booking.status !== 'cancelled' &&
    booking.status !== 'completed' &&
    (paymentStatus === null ||
      paymentStatus === 'created' ||
      paymentStatus === 'failed');
  // Contact details show whenever the booking has actually been
  // committed — confirmed / completed / cancelled — OR the payment has
  // landed. The web's payment-only gate hides contact on confirmed
  // bookings whose Payment row is still 'created' (race condition seen
  // in production data), which is wrong: once both parties have
  // committed they need to reach each other regardless of the payment
  // ledger state. Pending bookings stay locked until payment lands.
  const bookingCommitted = ['confirmed', 'completed', 'cancelled'].includes(
    String(booking.status || '').toLowerCase()
  );
  const showContact =
    bookingCommitted ||
    paymentStatus === 'paid' ||
    paymentStatus === 'refunded';

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
        showConnect={showContact}
      />

      <SummaryCard
        booking={booking}
        payment={payment}
        paymentStatus={paymentStatus}
        isPaymentPending={isPaymentPending}
        escrow={escrow}
      />

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

      {/* Review surfaces — visible on both sides once the pro marks the
          booking completed. Each surface is gated by its own permission
          flag so the form only appears when the API allows submission. */}
      {isCompleted && viewerIsClient ? (
        <>
          <ReviewCard
            title="Rate the consultation"
            icon="message-circle"
            existingReview={reviews.consultationByClient}
            canSubmit={!!permissions.canReviewConsultationAsClient}
            gateMessage="The consultation review unlocks once your professional marks this booking completed."
            submitting={!!reviewSubmitting.consultation}
            error={reviewErrors.consultation}
            onSubmit={(payload) => handleSubmitReview('consultation', payload)}
          />
          <ReviewCard
            title="Rate the professional (optional)"
            icon="star"
            existingReview={reviews.professional}
            canSubmit={!!permissions.canReviewProfessional}
            gateMessage="The professional review unlocks once this booking is completed."
            submitting={!!reviewSubmitting.professional}
            error={reviewErrors.professional}
            onSubmit={(payload) => handleSubmitReview('professional', payload)}
          />
          {reviews.consultationByProfessional ? (
            <CounterpartyReviewCard
              title="Professional's consultation review"
              review={reviews.consultationByProfessional}
            />
          ) : null}
        </>
      ) : null}

      {isCompleted && !viewerIsClient ? (
        <>
          <ReviewCard
            title="Rate the consultation"
            icon="message-circle"
            existingReview={reviews.consultationByProfessional}
            canSubmit={!!permissions.canReviewConsultationAsProfessional}
            gateMessage="Mark this booking completed to leave a consultation review."
            submitting={!!reviewSubmitting.consultation}
            error={reviewErrors.consultation}
            onSubmit={(payload) => handleSubmitReview('consultation', payload)}
          />
          {reviews.consultationByClient || reviews.professional ? (
            <CounterpartyReviewCard
              title="Client's reviews"
              review={reviews.consultationByClient}
              secondaryLabel={reviews.professional ? 'About you' : null}
              secondaryReview={reviews.professional}
            />
          ) : null}
        </>
      ) : null}

      {/* Pro-only: convert to case (or open the linked case if a previous
          conversion exists). One booking can only ever have one live case
          at a time — same constraint as the web detail view. */}
      {!viewerIsClient && (linkedCase || permissions.canConvertToCase) ? (
        <ConvertToCaseCard
          linkedCase={linkedCase}
          open={convertOpen}
          onOpen={() => {
            const fallbackTitle = `Case — ${
              (client && client.name) || 'Client'
            } (booking ${String(booking.id).slice(-8)})`;
            setConvertTitle(fallbackTitle);
            setConvertDescription('');
            setConvertError('');
            setConvertOpen(true);
          }}
          onCancel={() => {
            if (!convertSubmitting) setConvertOpen(false);
          }}
          title={convertTitle}
          setTitle={setConvertTitle}
          description={convertDescription}
          setDescription={setConvertDescription}
          submitting={convertSubmitting}
          error={convertError}
          onSubmit={handleConvert}
          onOpenLinkedCase={() => openCaseDetail(linkedCase && linkedCase.id)}
        />
      ) : null}
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

function SummaryCard({ booking, payment, paymentStatus, escrow }) {
  const status = String(booking.status || 'pending').toLowerCase();
  const isInstant = String(booking.type || '').toLowerCase() === 'instant';
  const whenLabel = isInstant
    ? 'Instant — Now'
    : booking.date
      ? `${formatDate(booking.date)}${booking.time ? ` · ${formatSlotLabel(booking.time)}` : ''}`
      : '—';

  // Payment amounts are paise end-to-end (backend services use paise as
  // the canonical unit, rupees only appear in formatters). Mobile must
  // use formatINR which divides by 100 — formatRupees would render 100×
  // the real value, which was the bug.
  const paid = paymentStatus === 'paid' || paymentStatus === 'refunded';
  const dueAmountPaise =
    payment && payment.amount
      ? Number(payment.amount)
      : Number(booking.estimatedCost) > 0
        ? Number(booking.estimatedCost) * 100
        : 0;
  const showAmountDue = !paid && dueAmountPaise > 0;

  return (
    <Card>
      <View style={styles.summaryHead}>
        <View style={styles.summaryHeadTitleRow}>
          <Text style={styles.cardTitle}>Booking summary</Text>
          {isInstant ? (
            <View style={styles.instantBadge}>
              <Feather
                name="zap"
                size={10}
                color="#92400e"
                style={{ marginRight: 3 }}
              />
              <Text style={styles.instantBadgeText}>
                {INSTANT_BOOKING_MULTIPLIER}× instant
              </Text>
            </View>
          ) : null}
        </View>
        <Badge variant={STATUS_VARIANT[status] || 'gray'}>{status}</Badge>
      </View>
      <View style={styles.detailGrid}>
        <Field label="When" value={whenLabel} />
        <Field
          label="Duration"
          value={booking.duration ? `${booking.duration} min` : '—'}
        />
        {paid && payment ? (
          <Field
            label="Amount paid"
            value={formatINR(payment.amount)}
            note={isInstant ? '(includes 2× instant rate)' : null}
          />
        ) : null}
        {showAmountDue ? (
          <Field
            label="Amount due"
            value={formatINR(dueAmountPaise)}
            note={isInstant ? '(includes 2× instant rate)' : null}
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

function Field({ label, value, note }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || '—'}</Text>
      {note ? <Text style={styles.detailNote}>{note}</Text> : null}
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
        <NoteAttachments attachments={note.attachments} />
      </View>
    </View>
  );
}

// Render note attachments. Images get inline thumbnails; everything
// else gets a paperclip pill that opens in the device browser.
function NoteAttachments({ attachments }) {
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
                key={`note-img-${i}`}
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
        <View style={styles.attachList}>
          {others.map((a, i) => {
            const uri = imageUrl(a.url);
            const fallbackName =
              a.name ||
              (a.url ? String(a.url).split('/').pop() : 'attachment');
            return (
              <Pressable
                key={`note-att-${i}`}
                onPress={() => uri && Linking.openURL(uri).catch(() => {})}
                style={({ pressed }) => [
                  styles.attachChip,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Feather
                  name="paperclip"
                  size={10}
                  color={colors.textSecondary}
                />
                <Text style={styles.attachChipText} numberOfLines={1}>
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
// Review surfaces
// ---------------------------------------------------------------------

function ReviewCard({
  title,
  icon = 'star',
  existingReview,
  canSubmit,
  gateMessage,
  submitting,
  error,
  onSubmit,
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  if (existingReview) {
    return (
      <Card>
        <View style={styles.sectionHeader}>
          <Feather name={icon} size={14} color={colors.primary} />
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        <View style={styles.reviewExisting}>
          <StarRow value={Number(existingReview.rating) || 0} />
          <Text style={styles.reviewExistingScore}>
            {Number(existingReview.rating).toFixed(0)} / 5
          </Text>
        </View>
        {existingReview.comment ? (
          <Text style={styles.reviewExistingBody}>
            “{existingReview.comment}”
          </Text>
        ) : null}
      </Card>
    );
  }

  if (!canSubmit) {
    return (
      <Card>
        <View style={styles.sectionHeader}>
          <Feather name={icon} size={14} color={colors.primary} />
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        <Text style={styles.reviewGate}>{gateMessage}</Text>
      </Card>
    );
  }

  const canSend = rating > 0 && !submitting;
  return (
    <Card>
      <View style={styles.sectionHeader}>
        <Feather name={icon} size={14} color={colors.primary} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={styles.reviewHint}>Tap a star to rate from 1 to 5.</Text>
      <StarRow value={rating} onChange={setRating} interactive />
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Add a comment (optional)"
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
        style={styles.reviewInput}
      />
      {error ? <Text style={styles.composerError}>{error}</Text> : null}
      <Pressable
        onPress={() => {
          if (!canSend) return;
          onSubmit({ rating, comment });
          setRating(0);
          setComment('');
        }}
        disabled={!canSend}
        style={({ pressed }) => [
          styles.postBtn,
          styles.reviewSubmitBtn,
          { opacity: !canSend ? 0.5 : pressed ? 0.92 : 1 },
        ]}
      >
        <LinearGradient
          colors={['#1f2937', '#0f172a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.postBtnFill}
        >
          {submitting ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Feather name="send" size={12} color={colors.textInverse} />
          )}
          <Text style={styles.postBtnText}>
            {submitting ? 'Sending…' : 'Submit review'}
          </Text>
        </LinearGradient>
      </Pressable>
    </Card>
  );
}

function StarRow({ value, onChange, interactive = false }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <View style={styles.starRow}>
      {stars.map((n) => {
        const filled = n <= value;
        const Comp = interactive ? Pressable : View;
        return (
          <Comp
            key={n}
            onPress={interactive ? () => onChange?.(n) : undefined}
            hitSlop={6}
            style={styles.starBtn}
          >
            <Feather
              name="star"
              size={interactive ? 26 : 16}
              color={filled ? colors.warning : colors.border}
              style={{
                // Feather doesn't render filled stars without `fill`; fake
                // the look by overlaying a slightly darker tint via opacity.
                opacity: filled ? 1 : 0.9,
              }}
            />
          </Comp>
        );
      })}
    </View>
  );
}

function CounterpartyReviewCard({
  title,
  review,
  secondaryLabel,
  secondaryReview,
}) {
  if (!review && !secondaryReview) return null;
  return (
    <Card>
      <View style={styles.sectionHeader}>
        <Feather name="eye" size={14} color={colors.primary} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {review ? (
        <View style={styles.cpReviewBlock}>
          <View style={styles.reviewExisting}>
            <StarRow value={Number(review.rating) || 0} />
            <Text style={styles.reviewExistingScore}>
              {Number(review.rating).toFixed(0)} / 5
            </Text>
          </View>
          {review.comment ? (
            <Text style={styles.reviewExistingBody}>“{review.comment}”</Text>
          ) : null}
        </View>
      ) : null}
      {secondaryReview ? (
        <View style={styles.cpReviewBlock}>
          {secondaryLabel ? (
            <Text style={styles.cpReviewLabel}>{secondaryLabel}</Text>
          ) : null}
          <View style={styles.reviewExisting}>
            <StarRow value={Number(secondaryReview.rating) || 0} />
            <Text style={styles.reviewExistingScore}>
              {Number(secondaryReview.rating).toFixed(0)} / 5
            </Text>
          </View>
          {secondaryReview.comment ? (
            <Text style={styles.reviewExistingBody}>
              “{secondaryReview.comment}”
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------
// Convert-to-case card (pro-only)
// ---------------------------------------------------------------------

function ConvertToCaseCard({
  linkedCase,
  open,
  onOpen,
  onCancel,
  title,
  setTitle,
  description,
  setDescription,
  submitting,
  error,
  onSubmit,
  onOpenLinkedCase,
}) {
  if (linkedCase) {
    return (
      <Card>
        <View style={styles.sectionHeader}>
          <Feather name="briefcase" size={14} color={colors.primary} />
          <Text style={styles.cardTitle}>Linked case</Text>
        </View>
        <Text style={styles.convertCopy}>
          This booking has already been converted into &ldquo;
          {linkedCase.title || 'a case'}&rdquo; ({linkedCase.status}). Delete
          the case if you want to convert this booking again.
        </Text>
        <Pressable
          onPress={onOpenLinkedCase}
          style={({ pressed }) => [
            styles.postBtn,
            { opacity: pressed ? 0.92 : 1, alignSelf: 'flex-start', marginTop: spacing.sm },
          ]}
        >
          <LinearGradient
            colors={['#1f2937', '#0f172a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.postBtnFill}
          >
            <Feather name="briefcase" size={12} color={colors.textInverse} />
            <Text style={styles.postBtnText}>Open case</Text>
          </LinearGradient>
        </Pressable>
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.sectionHeader}>
        <Feather name="briefcase" size={14} color={colors.primary} />
        <Text style={styles.cardTitle}>Convert to case</Text>
      </View>
      <Text style={styles.convertCopy}>
        Open a case from this booking — booking notes (with attachments) are
        copied into the case timeline so you don&rsquo;t lose context.
      </Text>

      {!open ? (
        <Pressable
          onPress={onOpen}
          style={({ pressed }) => [
            styles.postBtn,
            { opacity: pressed ? 0.92 : 1, alignSelf: 'flex-start', marginTop: spacing.sm },
          ]}
        >
          <LinearGradient
            colors={['#1f2937', '#0f172a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.postBtnFill}
          >
            <Feather name="briefcase" size={12} color={colors.textInverse} />
            <Text style={styles.postBtnText}>Convert</Text>
          </LinearGradient>
        </Pressable>
      ) : (
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          <View>
            <Text style={styles.convertFieldLabel}>Case title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Case title"
              placeholderTextColor={colors.textMuted}
              style={styles.convertInput}
            />
          </View>
          <View>
            <Text style={styles.convertFieldLabel}>Description (optional)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What is this case about?"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              style={[styles.convertInput, { minHeight: 80 }]}
            />
          </View>
          {error ? <Text style={styles.composerError}>{error}</Text> : null}
          <View style={styles.convertActions}>
            <Pressable
              onPress={onCancel}
              disabled={submitting}
              style={({ pressed }) => [
                styles.convertCancelBtn,
                { opacity: pressed || submitting ? 0.6 : 1 },
              ]}
            >
              <Text style={styles.convertCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onSubmit}
              disabled={submitting}
              style={({ pressed }) => [
                styles.postBtn,
                { opacity: submitting ? 0.6 : pressed ? 0.92 : 1 },
              ]}
            >
              <LinearGradient
                colors={['#1f2937', '#0f172a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.postBtnFill}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.textInverse} size="small" />
                ) : (
                  <Feather name="check" size={12} color={colors.textInverse} />
                )}
                <Text style={styles.postBtnText}>
                  {submitting ? 'Creating…' : 'Create case'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      )}
    </Card>
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
    gap: 8,
  },
  summaryHeadTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  instantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#fef3c7',
  },
  instantBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#92400e',
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
  detailNote: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: '#92400e',
  },
  reviewSubmitBtn: {
    marginTop: spacing.md,
    alignSelf: 'flex-end',
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
  // Inline image thumbnails — three across a typical row, with a
  // small border so the thumbnail reads as clickable.
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

  // Reviews
  reviewHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 6,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starBtn: {
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  reviewInput: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    minHeight: 64,
    maxHeight: 200,
    padding: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  reviewExisting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewExistingScore: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  reviewExistingBody: {
    marginTop: 6,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 19,
  },
  reviewGate: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  cpReviewBlock: {
    marginTop: spacing.sm,
  },
  cpReviewLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  // Convert to case
  convertCopy: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  convertFieldLabel: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  convertInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  convertActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  convertCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  convertCancelText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
});
