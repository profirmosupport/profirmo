import { MessageSquare, Star } from 'lucide-react';
import Card from '@/components/common/Card';
import RatingStars from '@/components/common/RatingStars';
import EmptyState from '@/components/common/EmptyState';
import { formatDate, getInitials } from '@/utils/formatters';
import { getReviewsByProfessional } from '@/data/mockData';

/**
 * ProfessionalReviews — review list for a professional.
 *
 * Props: { professionalId }
 */
export default function ProfessionalReviews({ professionalId }) {
  const reviews = getReviewsByProfessional(professionalId) || [];
  const count = reviews.length;
  const average =
    count > 0
      ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / count
      : 0;

  return (
    <Card>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-blue-600" />
          <h2 className="text-base font-semibold text-slate-900">
            Client reviews
          </h2>
        </div>
        {count > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-lg font-bold text-slate-900">
              {average.toFixed(1)}
            </span>
            <RatingStars rating={average} size="sm" showValue={false} />
            <span className="text-slate-500">
              ({count} review{count === 1 ? '' : 's'})
            </span>
          </div>
        )}
      </div>

      {count === 0 ? (
        <EmptyState
          icon={<Star size={24} />}
          title="No reviews yet"
          description="This professional has not received any client reviews so far."
        />
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="rounded-xl border border-slate-100 bg-slate-50/60 p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                  {getInitials(review.clientName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {review.clientName}
                    </p>
                    <span className="text-xs text-slate-400">
                      {formatDate(review.date)}
                    </span>
                  </div>
                  <div className="mt-1">
                    <RatingStars
                      rating={review.rating}
                      size="sm"
                      showValue={false}
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {review.comment}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
