'use client';

import { Star } from 'lucide-react';
import Card from '@/components/common/Card';
import RatingStars from '@/components/common/RatingStars';
import EmptyState from '@/components/common/EmptyState';
import { formatDate, getInitials } from '@/utils/formatters';

/**
 * ReviewManager — average rating summary plus a list of review cards.
 * Props: { reviews }
 */
export default function ReviewManager({ reviews }) {
  const list = reviews || [];

  if (list.length === 0) {
    return (
      <EmptyState
        icon={<Star size={24} />}
        title="No reviews yet"
        description="Reviews from clients will appear here after consultations."
      />
    );
  }

  const total = list.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
  const average = Math.round((total / list.length) * 10) / 10;

  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: list.filter((r) => Math.round(Number(r.rating) || 0) === star)
      .length,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="text-center sm:w-40 sm:border-r sm:border-slate-200">
            <p className="text-4xl font-bold text-slate-900">
              {average.toFixed(1)}
            </p>
            <div className="mt-1 flex justify-center">
              <RatingStars rating={average} size="md" showValue={false} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {list.length} {list.length === 1 ? 'review' : 'reviews'}
            </p>
          </div>
          <div className="flex-1 space-y-1.5">
            {distribution.map(({ star, count }) => {
              const pct = list.length ? (count / list.length) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-10 text-slate-500">{star} star</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-slate-500">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {list.map((review) => (
          <Card key={review.id}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                {getInitials(review.clientName)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-800">
                    {review.clientName || 'Anonymous client'}
                  </p>
                  <span className="text-xs text-slate-400">
                    {formatDate(review.date)}
                  </span>
                </div>
                <div className="mt-1">
                  <RatingStars rating={review.rating} size="sm" />
                </div>
                {review.comment && (
                  <p className="mt-2 text-sm text-slate-600">
                    {review.comment}
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
