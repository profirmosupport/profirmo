'use client';

// Booking flow hook — holds selected slot/date/duration, computes the
// estimated cost and creates bookings via the booking service.

import { useState, useMemo, useCallback } from 'react';
import bookingService from '@/services/bookingService';
import { BOOKING_TYPES } from '@/utils/constants';

/**
 * Compute estimated cost for a consultation.
 * @param {number} duration - minutes
 * @param {number} perMinuteRate - INR per minute
 */
export function calculateEstimatedCost(duration, perMinuteRate) {
  const d = Number(duration);
  const r = Number(perMinuteRate);
  if (!Number.isFinite(d) || !Number.isFinite(r)) return 0;
  return Math.max(0, Math.round(d * r));
}

/**
 * @param {Object} professional - the professional being booked (for the rate)
 */
export function useBooking(professional = null) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [duration, setDuration] = useState(30);
  const [bookingType, setBookingType] = useState(BOOKING_TYPES.SCHEDULED);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const perMinuteRate = professional ? professional.perMinuteRate : 0;

  const estimatedCost = useMemo(
    () => calculateEstimatedCost(duration, perMinuteRate),
    [duration, perMinuteRate]
  );

  const reset = useCallback(() => {
    setSelectedDate(null);
    setSelectedSlot(null);
    setDuration(30);
    setBookingType(BOOKING_TYPES.SCHEDULED);
    setError(null);
  }, []);

  /**
   * Create a booking. Merges held state with the supplied overrides.
   * @param {Object} overrides - { clientId, professionalId, date, time, ... }
   * @param {string} token - bearer token
   */
  const createBooking = useCallback(
    async (overrides = {}, token) => {
      setSubmitting(true);
      setError(null);
      try {
        const payload = {
          professionalId: professional ? professional.id : undefined,
          date: selectedDate,
          time: selectedSlot,
          duration,
          type: bookingType,
          estimatedCost,
          ...overrides,
        };
        const res = await bookingService.create(payload, token);
        return (res && res.data) || res;
      } catch (err) {
        setError(err.message || 'Failed to create booking.');
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [professional, selectedDate, selectedSlot, duration, bookingType, estimatedCost]
  );

  return {
    selectedDate,
    setSelectedDate,
    selectedSlot,
    setSelectedSlot,
    duration,
    setDuration,
    bookingType,
    setBookingType,
    estimatedCost,
    perMinuteRate,
    submitting,
    error,
    createBooking,
    reset,
  };
}

export default useBooking;
