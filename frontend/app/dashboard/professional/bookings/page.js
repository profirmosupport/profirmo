'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock,
  RefreshCw,
  AlertTriangle,
  Check,
  X,
  Eye,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Avatar from '@/components/common/Avatar';
import EmptyState from '@/components/common/EmptyState';
import ConnectChips from '@/components/booking/ConnectChips';
import bookingService from '@/services/bookingService';
import { ROLES } from '@/utils/constants';
import { formatDate, formatCurrency } from '@/utils/formatters';
import { formatSlotLabel } from '@/utils/availability';
// InstantBadge intentionally NOT imported here — the pro-side list shows
// only the basic Instant/Scheduled badge; the 2× pill lives on the
// booking page + the booking-detail view + the client list.

const STATUS_VARIANT = {
  pending: 'amber',
  confirmed: 'blue',
  completed: 'green',
  cancelled: 'red',
};

function Skeleton() {
  return (
    <div className="h-16 w-full animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
  );
}

export default function ProfessionalBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await bookingService.getMyAssignedBookings();
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load your bookings.');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatus(id, status) {
    setUpdatingId(id);
    try {
      await bookingService.updateStatus(id, status);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to update booking status.');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <DashboardLayout
      role={ROLES.PROFESSIONAL}
      title="Bookings"
      subtitle="Consultations booked with you by clients"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <CalendarClock size={18} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              {loading
                ? 'Loading bookings…'
                : `${bookings.length} booking${
                    bookings.length === 1 ? '' : 's'
                  }`}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={15} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <Card>
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle size={22} />
              </span>
              <p className="text-sm font-medium text-slate-700">{error}</p>
              <Button size="sm" onClick={load}>
                <RefreshCw size={15} />
                Try again
              </Button>
            </div>
          </Card>
        ) : bookings.length === 0 ? (
          <EmptyState
            icon={<CalendarClock size={24} />}
            title="No bookings yet"
            description="Consultations clients book with you will appear here."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  {/* Type column merged into When — the 2× instant pill
                      sits inline so the table stays one column narrower. */}
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Duration</th>
                  <th className="px-4 py-3 font-semibold">Est. cost</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Connect</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={b.client && b.client.profilePhoto}
                          name={(b.client && b.client.name) || ''}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {(b.client && b.client.name) || '—'}
                          </p>
                          {b.client && b.client.email && (
                            <p className="truncate text-xs text-slate-500">
                              {b.client.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex flex-col items-start gap-1">
                        {b.type ? (
                          <Badge
                            variant={
                              b.type === 'instant' ? 'green' : 'blue'
                            }
                          >
                            {b.type === 'instant' ? 'Instant' : 'Scheduled'}
                          </Badge>
                        ) : null}
                        <span className="text-sm text-slate-700">
                          {b.type === 'instant'
                            ? 'Now'
                            : b.date
                              ? `${formatDate(b.date)}${
                                  b.time ? `, ${formatSlotLabel(b.time)}` : ''
                                }`
                              : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {b.duration ? `${b.duration} min` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {b.estimatedCost
                        ? formatCurrency(Number(b.estimatedCost))
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[b.status] || 'gray'}>
                        {b.status || 'pending'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {b.client ? (
                        <ConnectChips
                          phone={b.client.phone}
                          email={b.client.email}
                          waMessage={`Hi ${b.client.name}, this is about your Profirmo booking.`}
                          emailSubject={`Profirmo booking ${b.id.slice(-8)}`}
                          size="sm"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {b.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={updatingId === b.id}
                              onClick={() => handleStatus(b.id, 'confirmed')}
                              title="Confirm"
                              aria-label="Confirm"
                            >
                              <Check size={15} />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updatingId === b.id}
                              onClick={() => handleStatus(b.id, 'cancelled')}
                              title="Decline"
                              aria-label="Decline"
                            >
                              <X size={15} />
                            </Button>
                          </>
                        )}
                        {b.status === 'confirmed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updatingId === b.id}
                            onClick={() => handleStatus(b.id, 'completed')}
                            title="Mark complete"
                            aria-label="Mark complete"
                          >
                            <Check size={15} />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          href={`/dashboard/professional/bookings/${b.id}`}
                          title="Details"
                          aria-label="Details"
                        >
                          <Eye size={15} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
