'use client';

import { useParams } from 'next/navigation';
import { Building2, MessageSquare, Star } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import RatingStars from '@/components/common/RatingStars';
import EmptyState from '@/components/common/EmptyState';
import FirmProfileHeader from '@/components/firms/FirmProfileHeader';
import FirmServices from '@/components/firms/FirmServices';
import FirmProfessionalsList from '@/components/firms/FirmProfessionalsList';
import { getFirmById, reviews } from '@/data/mockData';
import { formatDate, getInitials } from '@/utils/formatters';

export default function FirmProfilePage() {
  const { id } = useParams();
  const firm = getFirmById(id);

  if (!firm) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <EmptyState
              icon={<Building2 size={24} />}
              title="Firm not found"
              description="The firm you are looking for does not exist or may have been removed."
              action={
                <Button href="/firms" variant="primary">
                  Browse all firms
                </Button>
              }
            />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const firmReviews = reviews.filter((r) => r.firmId === id);
  const reviewCount = firmReviews.length;
  const averageRating =
    reviewCount > 0
      ? firmReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) /
        reviewCount
      : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          <FirmProfileHeader firm={firm} />
          <FirmServices firm={firm} />
          <FirmProfessionalsList firm={firm} />

          <Card>
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-blue-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  Client reviews
                </h2>
              </div>
              {reviewCount > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-lg font-bold text-slate-900">
                    {averageRating.toFixed(1)}
                  </span>
                  <RatingStars
                    rating={averageRating}
                    size="sm"
                    showValue={false}
                  />
                  <span className="text-slate-500">
                    ({reviewCount} review{reviewCount === 1 ? '' : 's'})
                  </span>
                </div>
              )}
            </div>

            {reviewCount === 0 ? (
              <EmptyState
                icon={<Star size={24} />}
                title="No reviews yet"
                description="This firm has not received any client reviews so far."
              />
            ) : (
              <ul className="space-y-4">
                {firmReviews.map((review) => (
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
        </div>
      </main>
      <Footer />
    </div>
  );
}
