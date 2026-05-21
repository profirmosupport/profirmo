import { MapPin, Users, Mail, Phone } from 'lucide-react';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import RatingStars from '@/components/common/RatingStars';
import { getInitials } from '@/utils/formatters';

/**
 * FirmProfileHeader — large header panel on a firm profile.
 *
 * Props: { firm }
 */
export default function FirmProfileHeader({ firm }) {
  if (!firm) return null;

  const {
    name,
    firmType,
    city,
    address,
    email,
    phone,
    rating,
    reviewsCount,
    professionalCount,
    description,
  } = firm;

  return (
    <Card>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-2xl font-bold text-white">
            {getInitials(name)}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
              <Badge variant={firmType === 'Tax Firm' ? 'amber' : 'blue'}>
                {firmType}
              </Badge>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} className="text-slate-400" />
                {city}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users size={15} className="text-slate-400" />
                {professionalCount} professional
                {professionalCount === 1 ? '' : 's'}
              </span>
              <RatingStars rating={rating} count={reviewsCount} size="sm" />
            </div>

            {address && (
              <p className="mt-2 text-sm text-slate-500">{address}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500">
              {email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={13} className="text-slate-400" />
                  {email}
                </span>
              )}
              {phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={13} className="text-slate-400" />
                  {phone}
                </span>
              )}
            </div>

            {description && (
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 lg:w-56">
          <Button
            href={email ? `mailto:${email}` : '/contact'}
            variant="primary"
            size="md"
            className="w-full"
          >
            Contact firm
          </Button>
          <p className="mt-2 text-center text-xs text-slate-400">
            Typically responds within a day
          </p>
        </div>
      </div>
    </Card>
  );
}
