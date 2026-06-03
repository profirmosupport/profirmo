// BookingScreen — mirrors the web /booking/[professionalId] page.
// Pro mini-card → consultation type (Instant / Scheduled) → date strip
// + time-slot grid (scheduled only) → duration → live summary → pay.
//
// Guests can pick options but must sign in to pay — the bottom CTA
// switches between Sign-in (guest) and Pay-with-Razorpay (logged-in
// client). Payment opens RazorpayCheckoutModal which renders Razorpay
// Standard Checkout in a WebView, then verifies the signature server-
// side to flip the booking + escrow records in one transaction.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Card from '../../components/common/Card';
import EmptyState from '../../components/common/EmptyState';
import { CardSkeleton } from '../../components/common/Skeleton';
import { computeInitials } from '../../components/guest/ProfessionalHorizontalCard';
import BookingCalendar from '../../components/booking/BookingCalendar';
import TimeSlotSelector from '../../components/booking/TimeSlotSelector';
import RazorpayCheckoutModal from '../../components/booking/RazorpayCheckoutModal';
import { useAuth } from '../../contexts/AuthContext';
import { getProfessional } from '../../services/professionalService';
import { createBooking } from '../../services/bookingService';
import {
  createBookingOrder,
  verifyBookingPayment,
} from '../../services/paymentService';
import { imageUrl } from '../../utils/imageUrl';
import { formatRupees } from '../../utils/formatters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const BOOKING_TYPES = { INSTANT: 'instant', SCHEDULED: 'scheduled' };
const DURATIONS = [15, 30, 45, 60];
const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function prettyDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function prettyTime(value) {
  if (!value) return '';
  const [hStr, mStr] = String(value).split(':');
  const h = Number(hStr);
  const m = Number(mStr || 0);
  if (!Number.isFinite(h)) return value;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export default function BookingScreen({ navigation, route }) {
  const { user, isGuest, exitGuest } = useAuth();
  const id = route?.params?.professionalId;

  const [pro, setPro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoFailed, setPhotoFailed] = useState(false);

  const [bookingType, setBookingType] = useState(BOOKING_TYPES.SCHEDULED);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [duration, setDuration] = useState(30);

  // Razorpay flow state. We hold the order returned by the backend in
  // local state and surface it to the WebView modal once it's ready.
  const [payState, setPayState] = useState({
    open: false,
    processing: false,
    order: null,
    keyId: null,
    bookingId: null,
  });
  const [confirmed, setConfirmed] = useState(null); // { type, date, time, duration, amount }
  const [payError, setPayError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await getProfessional(id);
      const item = (data && data.professional) || data;
      setPro(item || null);
      if (item && item.availableNow) setBookingType(BOOKING_TYPES.INSTANT);
    } catch (err) {
      setError(err.message || 'Failed to load this professional.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Surface slots for the picked day from the pro's `availability` map
  // (same shape the web uses). Falls back to a default grid inside
  // TimeSlotSelector when nothing is configured.
  const slotsForDay = useMemo(() => {
    if (!selectedDate || !pro) return undefined;
    const weekday = WEEKDAYS[new Date(`${selectedDate}T00:00:00`).getDay()];
    const entry = (pro.availability || []).find(
      (s) => s && s.day === weekday
    );
    return entry && Array.isArray(entry.slots) && entry.slots.length > 0
      ? entry.slots
      : undefined;
  }, [selectedDate, pro]);

  if (loading) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.body}>
        <CardSkeleton />
        <View style={{ height: spacing.md }} />
        <CardSkeleton />
      </ScrollView>
    );
  }
  if (error || !pro) {
    return (
      <View style={styles.root}>
        <EmptyState
          icon="alert-circle"
          title={error ? 'Something went wrong' : 'Professional not found'}
          description={error || 'This profile may have been removed.'}
        />
      </View>
    );
  }

  const photoUrl = imageUrl(pro.profilePhoto);
  const initials = computeInitials(pro.name);
  const subtitle = pro.designation || pro.professionalType || 'Professional';
  const perMinuteRate = pro.perMinuteRate ?? pro.consultationFee ?? 0;
  const estimatedCost = duration * Number(perMinuteRate || 0);
  const canBook = Boolean(
    pro.acceptsOnlineBooking ?? pro.acceptOnlineBooking ?? pro.bookable
  );
  const instantOk = Boolean(pro.availableNow);
  const isInstant = bookingType === BOOKING_TYPES.INSTANT;
  const isClient = !isGuest && user && (!user.role || user.role === 'client');
  const canConfirm =
    canBook &&
    (isInstant || (Boolean(selectedDate) && Boolean(selectedSlot)));

  function handleSelectDate(iso) {
    setSelectedDate(iso);
    setSelectedSlot(null);
  }

  async function startPayment() {
    if (!canConfirm) return;
    if (isGuest || !user) {
      exitGuest?.();
      return;
    }
    if (user.role && user.role !== 'client') {
      setPayError('Only clients can book a consultation.');
      return;
    }
    setPayError('');
    setPayState((prev) => ({ ...prev, processing: true }));
    try {
      const booking = await createBooking({
        professionalId: id,
        date: isInstant ? null : selectedDate,
        time: isInstant ? null : selectedSlot,
        duration,
        type: isInstant ? BOOKING_TYPES.INSTANT : BOOKING_TYPES.SCHEDULED,
      });
      if (!booking || !booking.id) {
        throw new Error('Could not create the booking. Please try again.');
      }
      const orderRes = await createBookingOrder(booking.id);
      if (!orderRes || !orderRes.keyId || !orderRes.order) {
        throw new Error('Razorpay is not configured on the server.');
      }
      setPayState({
        open: true,
        processing: false,
        order: orderRes.order,
        keyId: orderRes.keyId,
        bookingId: booking.id,
      });
    } catch (err) {
      setPayState((prev) => ({ ...prev, processing: false }));
      setPayError(err.message || 'Failed to start payment. Please try again.');
    }
  }

  async function handlePaymentSuccess(response) {
    setPayState((prev) => ({ ...prev, open: false, processing: true }));
    try {
      await verifyBookingPayment(response);
      setPayState({
        open: false,
        processing: false,
        order: null,
        keyId: null,
        bookingId: null,
      });
      setConfirmed({
        type: isInstant ? BOOKING_TYPES.INSTANT : BOOKING_TYPES.SCHEDULED,
        date: selectedDate,
        time: selectedSlot,
        duration,
        amount: estimatedCost,
      });
    } catch (err) {
      setPayState((prev) => ({ ...prev, processing: false }));
      setPayError(
        err.message ||
          'Payment captured but verification failed. Check My bookings to retry.'
      );
    }
  }

  function handlePaymentDismiss() {
    setPayState((prev) => ({ ...prev, open: false }));
    setPayError(
      'Payment was cancelled. Your booking is saved as pending — you can retry from My bookings.'
    );
  }

  function handlePaymentError(detail) {
    setPayState((prev) => ({ ...prev, open: false }));
    setPayError(
      (detail && detail.description) ||
        'Payment failed. Please try a different method.'
    );
  }

  function dismissConfirmed() {
    setConfirmed(null);
    // Drop the user into their bookings list under the Account tab.
    // `parent` is the per-stack navigator (Home/Search/etc.); its
    // `.getParent()` is the bottom-tab navigator that owns the
    // Account stack. We can't push a sub-route across stacks via
    // `navigate('GuestSignup', { screen: ... })` reliably, so we
    // first switch tabs, then ask the Account stack to push.
    try {
      const tabs = navigation.getParent?.()?.getParent?.();
      tabs?.navigate?.('GuestSignup', { screen: 'AccountBookings' });
    } catch {
      navigation.goBack?.();
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        {/* Pro mini-card */}
        <Card>
          <View style={styles.proRow}>
            {photoUrl && !photoFailed ? (
              <Image
                source={{ uri: photoUrl }}
                style={styles.avatar}
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <LinearGradient
                colors={['#fde68a', '#f59e0b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={styles.avatarInitials}>{initials}</Text>
              </LinearGradient>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {pro.name}
                </Text>
                {pro.verified ? (
                  <View style={styles.verifiedDot}>
                    <Feather name="check" size={9} color={colors.textInverse} />
                  </View>
                ) : null}
              </View>
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
              <View style={styles.metaRow}>
                {pro.rating ? (
                  <View style={styles.metaPill}>
                    <Feather name="star" size={10} color={colors.warning} />
                    <Text style={styles.metaText}>
                      {pro.rating} ({pro.reviewsCount || 0})
                    </Text>
                  </View>
                ) : null}
                {pro.city ? (
                  <View style={styles.metaPill}>
                    <Feather name="map-pin" size={10} color={colors.textMuted} />
                    <Text style={styles.metaText}>{pro.city}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </Card>

        {canBook ? (
          <>
            {/* Consultation type */}
            <Card>
              <Text style={styles.sectionLabel}>Consultation type</Text>
              <View style={styles.typeRow}>
                <TypeBtn
                  icon="zap"
                  title="Instant"
                  subtitle={
                    instantOk
                      ? 'Connect right now — pro is online'
                      : 'Currently offline'
                  }
                  disabled={!instantOk}
                  active={isInstant}
                  onPress={() =>
                    instantOk && setBookingType(BOOKING_TYPES.INSTANT)
                  }
                />
                <TypeBtn
                  icon="calendar"
                  title="Scheduled"
                  subtitle="Pick a date & time"
                  active={!isInstant}
                  onPress={() => setBookingType(BOOKING_TYPES.SCHEDULED)}
                />
              </View>
            </Card>

            {/* Date + time slots (scheduled only) */}
            {!isInstant ? (
              <>
                <Card>
                  <Text style={styles.sectionLabel}>Select a date</Text>
                  <Text style={styles.sectionHint}>
                    Available in the next 14 days
                  </Text>
                  <BookingCalendar
                    selectedDate={selectedDate}
                    onSelectDate={handleSelectDate}
                  />
                </Card>

                <Card>
                  <Text style={styles.sectionLabel}>Select a time slot</Text>
                  <Text style={styles.sectionHint}>
                    {selectedDate
                      ? `Slots for ${prettyDate(selectedDate)}`
                      : 'Pick a date first to see available slots'}
                  </Text>
                  {selectedDate ? (
                    <TimeSlotSelector
                      slots={slotsForDay}
                      selectedSlot={selectedSlot}
                      onSelectSlot={setSelectedSlot}
                    />
                  ) : (
                    <View style={styles.placeholder}>
                      <Text style={styles.placeholderText}>
                        No date selected yet
                      </Text>
                    </View>
                  )}
                </Card>
              </>
            ) : null}

            {/* Duration picker */}
            <Card>
              <Text style={styles.sectionLabel}>Estimated duration</Text>
              <Text style={styles.sectionHint}>
                You'll only be charged for the actual call length.
              </Text>
              <View style={styles.durationRow}>
                {DURATIONS.map((m) => {
                  const active = duration === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setDuration(m)}
                      style={({ pressed }) => [
                        styles.durationBtn,
                        active && styles.durationBtnActive,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.durationLabel,
                          active && styles.durationLabelActive,
                        ]}
                      >
                        {m} min
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.estimatedRow}>
                <Text style={styles.estimatedLabel}>Estimated cost</Text>
                <Text style={styles.estimatedAmount}>
                  {formatRupees(estimatedCost)}
                </Text>
              </View>
            </Card>

            {/* Live summary */}
            <Card>
              <Text style={styles.sectionLabel}>Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Type</Text>
                <Text style={styles.summaryValue}>
                  {isInstant ? 'Instant' : 'Scheduled'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>When</Text>
                <Text style={styles.summaryValue}>
                  {isInstant
                    ? 'Now'
                    : selectedDate
                      ? `${prettyDate(selectedDate)}${
                          selectedSlot ? ` · ${prettyTime(selectedSlot)}` : ''
                        }`
                      : 'Pick a date'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Duration</Text>
                <Text style={styles.summaryValue}>{duration} min</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Rate</Text>
                <Text style={styles.summaryValue}>
                  {formatRupees(perMinuteRate)} / min
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <Text style={[styles.summaryLabel, styles.summaryTotalLabel]}>
                  Estimated total
                </Text>
                <Text style={styles.totalAmount}>
                  {formatRupees(estimatedCost)}
                </Text>
              </View>
              <Text style={styles.fineprint}>
                Held in escrow until the consultation is complete. Final amount
                is billed at the actual call duration.
              </Text>
            </Card>

            {/* Warnings + errors */}
            {!isInstant && !canConfirm ? (
              <View style={styles.warn}>
                <Feather name="info" size={14} color={colors.warning} />
                <Text style={styles.warnText}>
                  Pick a date and a time slot to continue.
                </Text>
              </View>
            ) : null}
            {payError ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={14} color={colors.danger} />
                <Text style={styles.errorText}>{payError}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <Card>
            <View style={styles.notice}>
              <Feather name="info" size={14} color={colors.primary} />
              <Text style={styles.noticeText}>
                Online booking isn't available for this professional. You can
                still view their profile and contact them directly.
              </Text>
            </View>
          </Card>
        )}

        <View style={{ height: spacing['2xl'] }} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.ctaBar}>
        {isGuest || !user ? (
          <>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaLabel}>Sign in to pay</Text>
              <Text style={styles.ctaSub}>Bookings need a Profirmo account</Text>
            </View>
            <Pressable
              onPress={() => exitGuest?.()}
              style={({ pressed }) => [
                styles.ctaBtn,
                { opacity: pressed ? 0.92 : 1 },
              ]}
            >
              <LinearGradient
                colors={['#f59e0b', '#d97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaFill}
              >
                <Feather name="log-in" size={14} color={colors.textInverse} />
                <Text style={styles.ctaText}>Sign in</Text>
              </LinearGradient>
            </Pressable>
          </>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaLabel}>Amount due</Text>
              <Text style={styles.totalAmount}>
                {formatRupees(estimatedCost)}
              </Text>
            </View>
            <Pressable
              disabled={!canConfirm || payState.processing}
              onPress={startPayment}
              style={({ pressed }) => [
                styles.ctaBtn,
                { opacity: pressed ? 0.92 : 1 },
              ]}
            >
              <LinearGradient
                colors={
                  canConfirm && !payState.processing
                    ? ['#f59e0b', '#d97706']
                    : [colors.surfaceMuted, colors.surfaceMuted]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaFill}
              >
                {payState.processing ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <Feather
                    name="lock"
                    size={14}
                    color={
                      canConfirm ? colors.textInverse : colors.textMuted
                    }
                  />
                )}
                <Text
                  style={[
                    styles.ctaText,
                    !canConfirm && { color: colors.textMuted },
                  ]}
                >
                  {payState.processing
                    ? 'Preparing…'
                    : canConfirm
                      ? `Pay ${formatRupees(estimatedCost)}`
                      : 'Select details'}
                </Text>
              </LinearGradient>
            </Pressable>
          </>
        )}
      </View>

      {/* Razorpay checkout sheet */}
      <RazorpayCheckoutModal
        visible={payState.open}
        order={payState.order}
        keyId={payState.keyId}
        prefill={{
          name:
            (user && (user.fullName || user.name)) ||
            [user && user.firstName, user && user.lastName]
              .filter(Boolean)
              .join(' '),
          email: user && user.email,
          contact: user && (user.mobileNumber || user.phone),
        }}
        notes={`Consultation with ${pro.name || 'Profirmo professional'}`}
        professionalName={pro.name}
        onSuccess={handlePaymentSuccess}
        onCancel={handlePaymentDismiss}
        onError={handlePaymentError}
      />

      {/* Confirmation modal */}
      <Modal
        visible={Boolean(confirmed)}
        animationType="fade"
        transparent
        onRequestClose={dismissConfirmed}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Feather name="check" size={22} color={colors.textInverse} />
            </View>
            <Text style={styles.confirmTitle}>Booking confirmed</Text>
            <Text style={styles.confirmBody}>
              Your consultation with {pro.name} is booked. We've sent the
              details to your email.
            </Text>
            {confirmed ? (
              <View style={styles.confirmRows}>
                <ConfirmRow
                  label="Type"
                  value={
                    confirmed.type === BOOKING_TYPES.INSTANT
                      ? 'Instant'
                      : 'Scheduled'
                  }
                />
                <ConfirmRow
                  label="When"
                  value={
                    confirmed.type === BOOKING_TYPES.INSTANT
                      ? 'Now'
                      : `${prettyDate(confirmed.date)} · ${prettyTime(
                          confirmed.time
                        )}`
                  }
                />
                <ConfirmRow label="Duration" value={`${confirmed.duration} min`} />
                <ConfirmRow
                  label="Amount paid"
                  value={formatRupees(confirmed.amount)}
                  emphasis
                />
              </View>
            ) : null}
            <Pressable
              onPress={dismissConfirmed}
              style={({ pressed }) => [
                styles.confirmCta,
                { opacity: pressed ? 0.92 : 1 },
              ]}
            >
              <LinearGradient
                colors={['#f59e0b', '#d97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmCtaFill}
              >
                <Text style={styles.confirmCtaText}>Go to My bookings</Text>
                <Feather
                  name="arrow-right"
                  size={14}
                  color={colors.textInverse}
                />
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TypeBtn({ icon, title, subtitle, active, disabled, onPress }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.typeBtn,
        active && styles.typeBtnActive,
        disabled && styles.typeBtnDisabled,
        { opacity: pressed && !disabled ? 0.92 : 1 },
      ]}
    >
      <View
        style={[
          styles.typeIcon,
          active && {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
          },
        ]}
      >
        <Feather
          name={icon}
          size={16}
          color={active ? colors.textInverse : colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.typeTitle}>{title}</Text>
        <Text style={styles.typeSub}>{subtitle}</Text>
      </View>
      {active ? (
        <Feather name="check-circle" size={16} color={colors.primary} />
      ) : null}
    </Pressable>
  );
}

function ConfirmRow({ label, value, emphasis }) {
  return (
    <View style={styles.confirmRow}>
      <Text style={styles.confirmRowLabel}>{label}</Text>
      <Text
        style={[
          styles.confirmRowValue,
          emphasis && {
            color: colors.primary,
            fontSize: fontSize.base,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: 140, gap: spacing.md },

  proRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.5,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: {
    flexShrink: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  verifiedDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: 2,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  metaRow: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  metaText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionHint: {
    marginTop: 4,
    marginBottom: spacing.sm,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  typeRow: { marginTop: spacing.sm, gap: spacing.sm },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  typeBtnDisabled: { opacity: 0.5 },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(217,119,6,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  typeSub: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  placeholder: {
    paddingVertical: 18,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
  },
  placeholderText: { fontSize: fontSize.sm, color: colors.textMuted },

  durationRow: { flexDirection: 'row', gap: 6 },
  durationBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  durationBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  durationLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  durationLabelActive: { color: colors.primarySoftText },

  estimatedRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  estimatedLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  estimatedAmount: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  summaryValue: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: fontWeight.semibold,
    maxWidth: '60%',
    textAlign: 'right',
  },
  summaryTotal: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryTotalLabel: { fontWeight: fontWeight.bold, color: colors.textPrimary },
  totalAmount: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  fineprint: {
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  noticeText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.primarySoftText,
    lineHeight: 19,
  },

  warn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  warnText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.warning,
    fontWeight: fontWeight.semibold,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(220,38,38,0.08)',
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.danger,
    fontWeight: fontWeight.semibold,
    lineHeight: 17,
  },

  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ctaLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  ctaSub: { fontSize: 11, color: colors.textMuted },
  ctaBtn: { flex: 1.2, borderRadius: radius.lg, overflow: 'hidden' },
  ctaFill: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ctaText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },

  // Confirmation modal
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  confirmIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: {
    marginTop: spacing.md,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  confirmBody: {
    marginTop: 6,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  confirmRows: {
    marginTop: spacing.md,
    width: '100%',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    gap: 6,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmRowLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  confirmRowValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  confirmCta: {
    marginTop: spacing.md,
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  confirmCtaFill: {
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmCtaText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
});
