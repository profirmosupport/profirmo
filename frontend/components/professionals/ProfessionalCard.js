import { MapPin, BadgeCheck, Briefcase } from 'lucide-react';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import RatingStars from '@/components/common/RatingStars';
import { formatRate, getInitials } from '@/utils/formatters';

/**
 * ProfessionalCard — summary card for a single professional.
 *
 * Props: { professional }
 */
export default function ProfessionalCard({ professional }) {
  if (!professional) return null;

  const {
    id,
    name,
    professionType,
    specialization,
    city,
    experience,
    rating,
    reviewsCount,
    perMinuteRate,
    availableNow,
    verified,
  } = professional;

  return (
    <Card hover className="flex h-full flex-col">
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-semibold text-blue-700">
          {getInitials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-base font-semibold text-slate-900">
              {name}
            </h3>
            {verified && (
              <BadgeCheck
                size={16}
                className="shrink-0 text-blue-600"
                aria-label="Verified"
              />
            )}
          </div>
          <p className="mt-0.5 truncate text-sm font-medium text-blue-700">
            {professionType}
          </p>
          <p className="truncate text-xs text-slate-500">{specialization}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <MapPin size={14} className="text-slate-400" />
          {city}
        </span>
        <span className="inline-flex items-center gap-1">
          <Briefcase size={14} className="text-slate-400" />
          {experience} yrs exp
        </span>
      </div>

      <div className="mt-3">
        <RatingStars rating={rating} count={reviewsCount} size="sm" />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <div>
          <p className="text-base font-semibold text-slate-900">
            {formatRate(perMinuteRate)}
          </p>
          <p className="text-xs text-slate-400">Consultation rate</p>
        </div>
        {availableNow ? (
          <Badge variant="green">Available now</Badge>
        ) : (
          <Badge variant="gray">Offline</Badge>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          href={`/professionals/${id}`}
          variant="outline"
          size="sm"
          className="flex-1"
        >
          View profile
        </Button>
        <Button
          href={`/booking/${id}`}
          variant="primary"
          size="sm"
          className="flex-1"
        >
          Book now
        </Button>
      </div>
    </Card>
  );
}
