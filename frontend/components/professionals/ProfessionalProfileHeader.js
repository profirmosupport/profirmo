import { MapPin, BadgeCheck, Briefcase, ShieldCheck } from 'lucide-react';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import RatingStars from '@/components/common/RatingStars';
import { formatRate, getInitials } from '@/utils/formatters';

/**
 * ProfessionalProfileHeader — large header panel on a professional profile.
 *
 * Props: { professional }
 */
export default function ProfessionalProfileHeader({ professional }) {
  if (!professional) return null;

  const {
    id,
    name,
    professionType,
    specialization,
    city,
    experience,
    languages = [],
    rating,
    reviewsCount,
    perMinuteRate,
    availableNow,
    verified,
    registrationNumber,
  } = professional;

  const isLegal =
    /lawyer|advocate/i.test(professionType || '');
  const regLabel = isLegal
    ? 'Bar Council Reg. No.'
    : 'Tax / Professional Reg. No.';

  return (
    <Card>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-2xl font-bold text-blue-700">
            {getInitials(name)}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
              {verified && (
                <Badge variant="blue">
                  <BadgeCheck size={13} className="mr-1" />
                  Verified
                </Badge>
              )}
              {availableNow ? (
                <Badge variant="green">Available now</Badge>
              ) : (
                <Badge variant="gray">Offline</Badge>
              )}
            </div>
            <p className="mt-1 text-base font-semibold text-blue-700">
              {professionType}
            </p>
            <p className="text-sm text-slate-500">{specialization}</p>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} className="text-slate-400" />
                {city}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Briefcase size={15} className="text-slate-400" />
                {experience} years experience
              </span>
              <RatingStars rating={rating} count={reviewsCount} size="sm" />
            </div>

            {languages.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {languages.map((lang) => (
                  <span
                    key={lang}
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            )}

            {registrationNumber && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500">
                <ShieldCheck size={14} className="text-emerald-500" />
                {regLabel}{' '}
                <span className="font-medium text-slate-700">
                  {registrationNumber}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 rounded-xl bg-slate-50 p-5 text-center lg:w-56">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Consultation rate
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {formatRate(perMinuteRate)}
          </p>
          <Button
            href={`/booking/${id}`}
            variant="primary"
            size="md"
            className="mt-4 w-full"
          >
            Book consultation
          </Button>
          <p className="mt-2 text-xs text-slate-400">
            Pay only for the minutes you use
          </p>
        </div>
      </div>
    </Card>
  );
}
