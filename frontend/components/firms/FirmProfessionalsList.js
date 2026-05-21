import { Users, BadgeCheck } from 'lucide-react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import RatingStars from '@/components/common/RatingStars';
import EmptyState from '@/components/common/EmptyState';
import { formatRate, getInitials } from '@/utils/formatters';
import { getProfessionalsByFirm } from '@/data/mockData';

/**
 * FirmProfessionalsList — grid of professionals belonging to a firm.
 *
 * Props: { firm }
 */
export default function FirmProfessionalsList({ firm }) {
  const professionals = firm ? getProfessionalsByFirm(firm.id) || [] : [];

  return (
    <Card>
      <div className="mb-5 flex items-center gap-2">
        <Users size={18} className="text-blue-600" />
        <h2 className="text-base font-semibold text-slate-900">
          Professionals at this firm
        </h2>
      </div>

      {professionals.length === 0 ? (
        <EmptyState
          icon={<Users size={24} />}
          title="No professionals listed"
          description="This firm has not added any professionals yet."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {professionals.map((pro) => (
            <div
              key={pro.id}
              className="flex flex-col rounded-xl border border-slate-200 p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                  {getInitials(pro.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-sm font-semibold text-slate-900">
                      {pro.name}
                    </h3>
                    {pro.verified && (
                      <BadgeCheck
                        size={14}
                        className="shrink-0 text-blue-600"
                        aria-label="Verified"
                      />
                    )}
                  </div>
                  <p className="truncate text-xs font-medium text-blue-700">
                    {pro.professionType}
                  </p>
                  <div className="mt-1">
                    <RatingStars
                      rating={pro.rating}
                      count={pro.reviewsCount}
                      size="sm"
                    />
                  </div>
                </div>
              </div>

              <p className="mt-3 text-sm font-semibold text-slate-900">
                {formatRate(pro.perMinuteRate)}
              </p>

              <div className="mt-3 flex gap-2">
                <Button
                  href={`/professionals/${pro.id}`}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  View
                </Button>
                <Button
                  href={`/booking/${pro.id}`}
                  variant="primary"
                  size="sm"
                  className="flex-1"
                >
                  Book
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
