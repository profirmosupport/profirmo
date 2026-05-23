'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Zap,
  CalendarClock,
  Clock,
  Star,
  MapPin,
  CheckCircle2,
  UserX,
  AlertCircle,
} from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import Modal from '@/components/common/Modal';
import Avatar from '@/components/common/Avatar';
import EmptyState from '@/components/common/EmptyState';
import BookingCalendar from '@/components/booking/BookingCalendar';
import TimeSlotSelector from '@/components/booking/TimeSlotSelector';
import ConsultationSummary from '@/components/booking/ConsultationSummary';
import PaymentPlaceholder from '@/components/booking/PaymentPlaceholder';
import { useLanguage } from '@/components/LanguageProvider';
import professionalService from '@/services/professionalService';
import bookingService from '@/services/bookingService';
import { useAuth } from '@/components/AuthProvider';
import { BOOKING_TYPES } from '@/utils/constants';
import { formatCurrency, formatDate, formatTime } from '@/utils/formatters';

const DURATIONS = [15, 30, 45, 60];

export default function BookingPage() {
  const { t } = useLanguage();
  const { professionalId } = useParams();
  const { user, isAuthenticated } = useAuth();

  const [professional, setProfessional] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [bookingType, setBookingType] = useState(BOOKING_TYPES.SCHEDULED);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [duration, setDuration] = useState(30);
  const [processing, setProcessing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [createdBooking, setCreatedBooking] = useState(null);

  // Load the professional from the database via the API.
  useEffect(() => {
    if (!professionalId) return;
    let active = true;
    setLoading(true);
    setError(null);
    setProfessional(null);
    (async () => {
      try {
        const data = await professionalService.getById(professionalId);
        if (!active) return;
        if (!data || !data.id) {
          setProfessional(null);
        } else {
          setProfessional(data);
          if (data.availableNow) setBookingType(BOOKING_TYPES.INSTANT);
        }
      } catch (err) {
        if (!active) return;
        if (err && err.status === 404) setProfessional(null);
        else setError(err.message || 'Failed to load this professional.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [professionalId]);

  const isInstant = bookingType === BOOKING_TYPES.INSTANT;
  const rate = professional ? Number(professional.consultationFee) || 0 : 0;
  const estimatedCost = duration * rate;

  // Seed time slots from the professional's availability for the selected day.
  const slotsForDay = useMemo(() => {
    if (!selectedDate || !professional) return undefined;
    const weekday = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
      'en-IN',
      { weekday: 'long' }
    );
    const entry = (professional.availability || []).find(
      (s) => s && s.day === weekday
    );
    return entry && Array.isArray(entry.slots) && entry.slots.length > 0
      ? entry.slots
      : undefined;
  }, [selectedDate, professional]);

  const canConfirm =
    isInstant || (Boolean(selectedDate) && Boolean(selectedSlot));

  function handleSelectDate(iso) {
    setSelectedDate(iso);
    setSelectedSlot(null);
  }

  async function handlePay() {
    if (!canConfirm) return;
    if (!isAuthenticated) {
      setBookingError('Please sign in as a client to book a consultation.');
      return;
    }
    if (user && user.role && user.role !== 'client') {
      setBookingError('Only clients can book a consultation.');
      return;
    }
    setProcessing(true);
    setBookingError('');
    try {
      const booking = await bookingService.createBooking({
        professionalId,
        date: isInstant ? null : selectedDate,
        time: isInstant ? null : selectedSlot,
        duration,
        type: isInstant ? BOOKING_TYPES.INSTANT : BOOKING_TYPES.SCHEDULED,
      });
      setCreatedBooking(booking);
      setConfirmed(true);
    } catch (err) {
      setBookingError(err.message || 'Failed to create booking.');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 bg-slate-50">
          <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
            <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-slate-100 lg:col-span-2" />
              <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <EmptyState
              icon={<AlertCircle size={24} />}
              title="Something went wrong"
              description={error}
              action={
                <Button href="/professionals" variant="primary">
                  {t('profDetail.browseAll')}
                </Button>
              }
            />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!professional) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <EmptyState
              icon={<UserX size={24} />}
              title={t('profDetail.notFoundTitle')}
              description={t('profDetail.notFoundDesc')}
              action={
                <Button href="/professionals" variant="primary">
                  {t('profDetail.browseAll')}
                </Button>
              }
            />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t('bookingPage.title')}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {t('bookingPage.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left column */}
            <div className="space-y-6 lg:col-span-2">
              {/* Professional banner */}
              <Card>
                <div className="flex flex-wrap items-center gap-4">
                  <Avatar
                    src={professional.profilePhoto}
                    name={professional.name}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-900">
                        {professional.name}
                      </h2>
                      {professional.verified && (
                        <Badge variant="green">
                          {t('bookingPage.verified')}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {professional.professionalType}
                      {professional.specialization
                        ? ` · ${professional.specialization}`
                        : ''}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Star
                          size={13}
                          className="fill-amber-400 text-amber-400"
                        />
                        {professional.rating || 0} (
                        {t('bookingPage.reviews', {
                          count: professional.reviewsCount || 0,
                        })}
                        )
                      </span>
                      {professional.city && (
                        <span className="flex items-center gap-1">
                          <MapPin size={13} />
                          {professional.city}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Consultation type chooser */}
              <Card>
                <h3 className="text-sm font-semibold text-slate-800">
                  {t('bookingPage.consultationType')}
                </h3>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={!professional.availableNow}
                    onClick={() => setBookingType(BOOKING_TYPES.INSTANT)}
                    className={`rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      isInstant
                        ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                        : 'border-slate-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap
                        size={18}
                        className={
                          isInstant ? 'text-blue-600' : 'text-slate-400'
                        }
                      />
                      <span className="text-sm font-semibold text-slate-800">
                        {t('bookingPage.instant')}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {professional.availableNow
                        ? t('bookingPage.instantAvailable')
                        : t('bookingPage.instantUnavailable')}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBookingType(BOOKING_TYPES.SCHEDULED)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      !isInstant
                        ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                        : 'border-slate-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CalendarClock
                        size={18}
                        className={
                          !isInstant ? 'text-blue-600' : 'text-slate-400'
                        }
                      />
                      <span className="text-sm font-semibold text-slate-800">
                        {t('bookingPage.scheduled')}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {t('bookingPage.scheduledDesc')}
                    </p>
                  </button>
                </div>
              </Card>

              {/* Date & time (scheduled only) */}
              {!isInstant && (
                <>
                  <Card>
                    <h3 className="text-sm font-semibold text-slate-800">
                      {t('bookingPage.selectDate')}
                    </h3>
                    <p className="mb-3 mt-0.5 text-xs text-slate-500">
                      {t('bookingPage.selectDateDesc')}
                    </p>
                    <BookingCalendar
                      selectedDate={selectedDate}
                      onSelectDate={handleSelectDate}
                    />
                  </Card>

                  <Card>
                    <h3 className="text-sm font-semibold text-slate-800">
                      {t('bookingPage.selectSlot')}
                    </h3>
                    <p className="mb-3 mt-0.5 text-xs text-slate-500">
                      {selectedDate
                        ? t('bookingPage.slotsFor', {
                            date: formatDate(selectedDate),
                          })
                        : t('bookingPage.pickDateFirst')}
                    </p>
                    {selectedDate ? (
                      <TimeSlotSelector
                        slots={slotsForDay}
                        selectedSlot={selectedSlot}
                        onSelectSlot={setSelectedSlot}
                      />
                    ) : (
                      <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                        {t('bookingPage.noDateSelected')}
                      </p>
                    )}
                  </Card>
                </>
              )}

              {/* Duration selector */}
              <Card>
                <h3 className="text-sm font-semibold text-slate-800">
                  {t('bookingPage.estimatedDuration')}
                </h3>
                <p className="mb-3 mt-0.5 text-xs text-slate-500">
                  {t('bookingPage.durationDesc')}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {DURATIONS.map((d) => {
                    const active = duration === d;
                    return (
                      <Button
                        key={d}
                        variant={active ? 'primary' : 'outline'}
                        onClick={() => setDuration(d)}
                      >
                        <Clock size={15} />
                        {t('bookingPage.minutesShort', { count: d })}
                      </Button>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-600">
                    {t('bookingPage.estimatedCost')}
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    {formatCurrency(estimatedCost)}
                  </span>
                </div>
              </Card>
            </div>

            {/* Right column (sticky) */}
            <div className="lg:col-span-1">
              <div className="space-y-6 lg:sticky lg:top-24">
                <ConsultationSummary
                  professional={professional}
                  type={bookingType}
                  date={selectedDate}
                  time={selectedSlot}
                  duration={duration}
                />

                {!isInstant && !canConfirm && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {t('bookingPage.selectDateTimeWarning')}
                  </p>
                )}
                {bookingError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                    {bookingError}
                  </p>
                )}

                <PaymentPlaceholder
                  amount={estimatedCost}
                  onPay={handlePay}
                  processing={processing || !canConfirm}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Confirmation modal */}
      <Modal
        open={confirmed}
        onClose={() => setConfirmed(false)}
        title={t('bookingPage.confirmedTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmed(false)}>
              {t('bookingPage.close')}
            </Button>
            <Button
              href={
                createdBooking && createdBooking.consultationId
                  ? `/consultation/${createdBooking.consultationId}`
                  : '/dashboard/client/bookings'
              }
            >
              {t('bookingPage.joinRoom')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 size={26} />
          </span>
          <p className="mt-3 text-sm text-slate-600">
            {t('bookingPage.confirmedBody', {
              name: professional.name,
            })}
          </p>
        </div>

        <dl className="mt-5 space-y-2.5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">{t('bookingPage.type')}</dt>
            <dd className="font-medium text-slate-800">
              {isInstant
                ? t('bookingPage.typeInstant')
                : t('bookingPage.typeScheduled')}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">{t('bookingPage.when')}</dt>
            <dd className="font-medium text-slate-800">
              {isInstant
                ? t('bookingPage.whenNow')
                : `${formatDate(selectedDate)}, ${formatTime(selectedSlot)}`}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">{t('bookingPage.duration')}</dt>
            <dd className="font-medium text-slate-800">
              {t('bookingPage.durationMinutes', { count: duration })}
            </dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2.5">
            <dt className="text-slate-500">{t('bookingPage.amountPaid')}</dt>
            <dd className="font-bold text-slate-900">
              {formatCurrency(estimatedCost)}
            </dd>
          </div>
        </dl>
      </Modal>
    </div>
  );
}
