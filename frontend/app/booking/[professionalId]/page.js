'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Zap,
  CalendarClock,
  Clock,
  Star,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import Modal from '@/components/common/Modal';
import BookingCalendar from '@/components/booking/BookingCalendar';
import TimeSlotSelector from '@/components/booking/TimeSlotSelector';
import ConsultationSummary from '@/components/booking/ConsultationSummary';
import PaymentPlaceholder from '@/components/booking/PaymentPlaceholder';
import { professionals, getProfessionalById, consultations } from '@/data/mockData';
import { BOOKING_TYPES } from '@/utils/constants';
import { formatCurrency, formatDate, formatTime, getInitials } from '@/utils/formatters';

const DURATIONS = [15, 30, 45, 60];

export default function BookingPage() {
  const { professionalId } = useParams();
  const professional =
    getProfessionalById(professionalId) || professionals[0];

  const [bookingType, setBookingType] = useState(
    professional.availableNow ? BOOKING_TYPES.INSTANT : BOOKING_TYPES.SCHEDULED
  );
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [duration, setDuration] = useState(30);
  const [processing, setProcessing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const isInstant = bookingType === BOOKING_TYPES.INSTANT;
  const rate = Number(professional.perMinuteRate) || 0;
  const estimatedCost = duration * rate;
  const consultationId = (consultations[0] && consultations[0].id) || 'con-1';

  // Seed time slots from the professional's availability for the selected day.
  const slotsForDay = useMemo(() => {
    if (!selectedDate) return undefined;
    const weekday = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
      'en-IN',
      { weekday: 'long' }
    );
    const entry = (professional.availabilitySlots || []).find(
      (s) => s.day === weekday
    );
    return entry && entry.slots && entry.slots.length > 0
      ? entry.slots
      : undefined;
  }, [selectedDate, professional]);

  const canConfirm =
    isInstant || (Boolean(selectedDate) && Boolean(selectedSlot));

  function handleSelectDate(iso) {
    setSelectedDate(iso);
    setSelectedSlot(null);
  }

  function handlePay() {
    if (!canConfirm) return;
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setConfirmed(true);
    }, 900);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Book a consultation
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Choose how and when you would like to connect with your expert.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left column */}
            <div className="space-y-6 lg:col-span-2">
              {/* Professional banner */}
              <Card>
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-semibold text-blue-700">
                    {getInitials(professional.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-900">
                        {professional.name}
                      </h2>
                      {professional.verified && (
                        <Badge variant="green">Verified</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {professional.professionType} ·{' '}
                      {professional.specialization}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Star
                          size={13}
                          className="fill-amber-400 text-amber-400"
                        />
                        {professional.rating} ({professional.reviewsCount}{' '}
                        reviews)
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={13} />
                        {professional.city}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Consultation type chooser */}
              <Card>
                <h3 className="text-sm font-semibold text-slate-800">
                  Consultation type
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
                        Instant consultation
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {professional.availableNow
                        ? 'Connect right now — the expert is available.'
                        : 'The expert is not available right now.'}
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
                        Scheduled consultation
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">
                      Pick a date and time slot that works for you.
                    </p>
                  </button>
                </div>
              </Card>

              {/* Date & time (scheduled only) */}
              {!isInstant && (
                <>
                  <Card>
                    <h3 className="text-sm font-semibold text-slate-800">
                      Select a date
                    </h3>
                    <p className="mb-3 mt-0.5 text-xs text-slate-500">
                      Available within the next 14 days.
                    </p>
                    <BookingCalendar
                      selectedDate={selectedDate}
                      onSelectDate={handleSelectDate}
                    />
                  </Card>

                  <Card>
                    <h3 className="text-sm font-semibold text-slate-800">
                      Select a time slot
                    </h3>
                    <p className="mb-3 mt-0.5 text-xs text-slate-500">
                      {selectedDate
                        ? `Slots for ${formatDate(selectedDate)}.`
                        : 'Pick a date first to see available slots.'}
                    </p>
                    {selectedDate ? (
                      <TimeSlotSelector
                        slots={slotsForDay}
                        selectedSlot={selectedSlot}
                        onSelectSlot={setSelectedSlot}
                      />
                    ) : (
                      <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                        No date selected yet.
                      </p>
                    )}
                  </Card>
                </>
              )}

              {/* Duration selector */}
              <Card>
                <h3 className="text-sm font-semibold text-slate-800">
                  Estimated duration
                </h3>
                <p className="mb-3 mt-0.5 text-xs text-slate-500">
                  You are billed per minute for the actual call length.
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
                        {d} min
                      </Button>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-600">
                    Estimated cost
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
                    Select a date and time slot to continue.
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
        title="Booking confirmed!"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmed(false)}>
              Close
            </Button>
            <Button href={`/consultation/${consultationId}`}>
              Join consultation room
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 size={26} />
          </span>
          <p className="mt-3 text-sm text-slate-600">
            Your consultation with{' '}
            <span className="font-semibold text-slate-800">
              {professional.name}
            </span>{' '}
            is confirmed.
          </p>
        </div>

        <dl className="mt-5 space-y-2.5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Type</dt>
            <dd className="font-medium text-slate-800">
              {isInstant ? 'Instant' : 'Scheduled'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">When</dt>
            <dd className="font-medium text-slate-800">
              {isInstant
                ? 'Now'
                : `${formatDate(selectedDate)}, ${formatTime(selectedSlot)}`}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Duration</dt>
            <dd className="font-medium text-slate-800">{duration} minutes</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2.5">
            <dt className="text-slate-500">Amount paid</dt>
            <dd className="font-bold text-slate-900">
              {formatCurrency(estimatedCost)}
            </dd>
          </div>
        </dl>
      </Modal>
    </div>
  );
}
