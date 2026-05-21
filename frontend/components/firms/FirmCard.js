import { MapPin, Users } from 'lucide-react';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import RatingStars from '@/components/common/RatingStars';
import { getInitials } from '@/utils/formatters';

/**
 * FirmCard — summary card for a single firm.
 *
 * Props: { firm }
 */
export default function FirmCard({ firm }) {
  if (!firm) return null;

  const {
    id,
    name,
    firmType,
    city,
    rating,
    reviewsCount,
    professionalCount,
    services = [],
  } = firm;

  return (
    <Card hover className="flex h-full flex-col">
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-lg font-semibold text-white">
          {getInitials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-slate-900">
            {name}
          </h3>
          <div className="mt-1">
            <Badge variant={firmType === 'Tax Firm' ? 'amber' : 'blue'}>
              {firmType}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <MapPin size={14} className="text-slate-400" />
          {city}
        </span>
        <span className="inline-flex items-center gap-1">
          <Users size={14} className="text-slate-400" />
          {professionalCount} professional{professionalCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="mt-3">
        <RatingStars rating={rating} count={reviewsCount} size="sm" />
      </div>

      {services.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {services.slice(0, 3).map((service) => (
            <span
              key={service}
              className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
            >
              {service}
            </span>
          ))}
          {services.length > 3 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
              +{services.length - 3} more
            </span>
          )}
        </div>
      )}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <Button
          href={`/firms/${id}`}
          variant="outline"
          size="sm"
          className="w-full"
        >
          View firm
        </Button>
      </div>
    </Card>
  );
}
