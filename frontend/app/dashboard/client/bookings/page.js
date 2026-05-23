'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, RefreshCw, AlertTriangle, Eye, Video } from 'lucide-react';
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

export default function ClientBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await bookingService.getMyBookings();
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

  return (
    <DashboardLayout
      role={ROLES.CLIENT}
      title="My bookings"
      subtitle="Consultations you have scheduled with professionals"
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
            description="Consultations you book with professionals will appear here."
            action={
              <Button href="/professionals" variant="primary">
                Find a professional
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Professional</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Duration</th>
                  <th className="px-4 py-3 font-semibold">Cost</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">
                      {b.professionalId || '—'}
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
                        {b.consultationId &&
                          b.status !== 'cancelled' &&
                          b.callStatus !== 'ended' && (
                            <Button
                              size="sm"
                              variant="primary"
                              href={`/consultation/${b.consultationId}`}
                            >
                              <Video size={15} />
                              Join call
                            </Button>
                          )}
                        <Button
                          size="sm"
                          variant="outline"
                          href={`/professionals/${b.professionalId}`}
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
