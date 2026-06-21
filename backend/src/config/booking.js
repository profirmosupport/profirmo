// Booking pricing constants — kept server-side so the displayed cost,
// the stored estimatedCost on the booking row, and the Razorpay order
// amount all agree. Mirrors INSTANT_BOOKING_MULTIPLIER in
// frontend/utils/constants.js. Keep both in sync.
//
// Instant bookings interrupt a professional mid-flow and require them
// to drop whatever they're doing — they earn 2× per minute. The same
// multiplier is what the client pays.

const INSTANT_BOOKING_MULTIPLIER = 2;

/**
 * Resolve the per-minute rate that should be billed for a given booking
 * type. Pass the professional's declared base rate (their scheduled
 * consultation fee) and the booking type string.
 *
 * @param {number} baseRate    professional.consultationFee (per minute)
 * @param {string} bookingType 'instant' | 'scheduled' | other
 * @returns {number}
 */
function effectiveRateFor(baseRate, bookingType) {
  const base = Number(baseRate) || 0;
  if (String(bookingType || '').toLowerCase() === 'instant') {
    return base * INSTANT_BOOKING_MULTIPLIER;
  }
  return base;
}

module.exports = {
  INSTANT_BOOKING_MULTIPLIER,
  effectiveRateFor,
};
