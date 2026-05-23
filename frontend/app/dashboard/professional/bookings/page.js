'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock,
  RefreshCw,
  AlertTriangle,
  Check,
  X,
  Video,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import EmptyState from '@/components/common/EmptyState';
import bookingService from '@/services/bookingService';
import { ROLES } from '@/utils/constants';
import { formatDate, formatTime, formatCurrency } from '@/utils/formatters';

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
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Duration</th>
                  <th className="px-4 py-3 font-semibold">Est. cost</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">
                      {b.clientId || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 capitalize">
                      {b.type || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {b.type === 'instant'
                        ? 'Now'
                        : b.date
                          ? `${formatDate(b.date)}${
                              b.time ? `, ${formatTime(b.time)}` : ''
                            }`
                          : '—'}
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
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {b.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={updatingId === b.id}
                              onClick={() => handleStatus(b.id, 'confirmed')}
                            >
                              <Check size={15} />
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updatingId === b.id}
                              onClick={() => handleStatus(b.id, 'cancelled')}
                            >
                              <X size={15} />
                              Decline
                            </Button>
                          </>
                        )}
                        {b.consultationId &&
                          b.status !== 'cancelled' &&
                          b.callStatus !== 'ended' &&
                          b.status !== 'pending' && (
                            <Button
                              size="sm"
                              variant="primary"
                              href={`/consultation/${b.consultationId}`}
                            >
                              <Video size={15} />
                              Join call
                            </Button>
                          )}
                        {b.status === 'confirmed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updatingId === b.id}
                            onClick={() => handleStatus(b.id, 'completed')}
                          >
                            <Check size={15} />
                            Mark complete
                          </Button>
                        )}
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
