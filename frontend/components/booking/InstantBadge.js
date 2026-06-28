'use client';

// InstantBadge — small amber chip flagging an instant booking.
// Single source of truth for the visual marker so the booking page,
// the client/professional bookings lists, the booking-detail view,
// and the professional payments table all look identical.

import { Zap } from 'lucide-react';
import { INSTANT_BOOKING_MULTIPLIER } from '@/utils/constants';

const SIZES = {
  xs: 'gap-0.5 px-1.5 py-0.5 text-[10px]',
  sm: 'gap-1 px-2 py-0.5 text-[11px]',
};

const ICON_SIZE = { xs: 9, sm: 11 };

/**
 * Props:
 *  - size       'xs' | 'sm'   default 'xs'
 *  - showLabel  boolean       default true (when false renders just the icon + Nx)
 */
export default function InstantBadge({ size = 'xs', showLabel = true }) {
  const s = SIZES[size] || SIZES.xs;
  return (
    <span
      className={`inline-flex items-center rounded-full bg-amber-100 font-bold uppercase tracking-wide text-amber-700 ${s}`}
      title={`Instant bookings are charged at ${INSTANT_BOOKING_MULTIPLIER}× the per-minute rate`}
    >
      <Zap size={ICON_SIZE[size] || ICON_SIZE.xs} className="fill-amber-500" />
      {showLabel ? `${INSTANT_BOOKING_MULTIPLIER}× instant` : `${INSTANT_BOOKING_MULTIPLIER}×`}
    </span>
  );
}

/**
 * Helper: is the given booking-like object an instant booking?
 * Accepts { type } or { bookingType } shapes.
 */
export function isInstantBooking(obj) {
  if (!obj) return false;
  const t = String(obj.type || obj.bookingType || '').toLowerCase();
  return t === 'instant';
}
