'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Star } from 'lucide-react';
import Card from '@/components/common/Card';
import Avatar from '@/components/common/Avatar';
import Button from '@/components/common/Button';
import RatingStars from '@/components/common/RatingStars';
import EmptyState from '@/components/common/EmptyState';
import { useLanguage } from '@/components/LanguageProvider';
import { formatDate } from '@/utils/formatters';
import reviewService from '@/services/reviewService';

/**
 * FirmReviews — review list for a firm, fetched from the API
 * (GET /api/reviews/firm/:firmId). Shows a "No review yet" empty state when
 * there are none.
 *
 * Props: { firmId, onAppeal? } — when `onAppeal` is provided, each review row
 * renders an "Appeal" button that hands the review back to the parent for
 * collecting an appeal reason.
 */
export default function FirmReviews({ firmId, onAppeal }) {
  const { t } = useLanguage();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firmId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const res = await reviewService.getByFirm(firmId);
        const data = (res && res.data) || res || [];
        if (active) setReviews(Array.isArray(data) ? data : []);
      } catch {
        if (active) setReviews([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [firmId]);

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
            {t('firmDetail.clientReviews')}
          </h2>
        </div>
        {!loading && count > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-lg font-bold text-slate-900">
              {average.toFixed(1)}
            </span>
            <RatingStars rating={average} size="sm" showValue={false} />
            <span className="text-slate-500">
              {count === 1
                ? t('firmDetail.reviewCountOne', { count })
                : t('firmDetail.reviewCountOther', { count })}
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-slate-100 bg-slate-50"
            />
          ))}
        </div>
      ) : count === 0 ? (
        <EmptyState
          icon={<Star size={24} />}
          title={t('profCmp.noReviewYet')}
          description={t('firmDetail.noReviewsDesc')}
        />
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => {
            const clientName =
              review.clientName || review.authorName || review.name || 'Client';
            return (
              <li
                key={review.id}
                className="rounded-xl border border-slate-100 bg-slate-50/60 p-4"
              >
                <div className="flex items-start gap-3">
                  <Avatar
                    src={review.clientPhoto || review.authorPhoto}
                    name={clientName}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {clientName}
                      </p>
                      <span className="text-xs text-slate-400">
                        {formatDate(review.date || review.createdAt)}
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
                      {review.comment || review.text}
                    </p>
                    {typeof onAppeal === 'function' && (
                      <div className="mt-3 flex items-center justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAppeal(review)}
                        >
                          Appeal
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
