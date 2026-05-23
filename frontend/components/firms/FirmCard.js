'use client';

import { MapPin, Users } from 'lucide-react';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import Avatar from '@/components/common/Avatar';
import RatingStars from '@/components/common/RatingStars';
import { useLanguage } from '@/components/LanguageProvider';

/**
 * FirmCard — summary card for a single firm.
 * Renders the API shape: firmName, logo, firmType, city, practiceAreas,
 * rating, reviewsCount, professionalCount.
 *
 * Props: { firm }
 */
export default function FirmCard({ firm }) {
  const { t } = useLanguage();
  if (!firm) return null;

  const {
    id,
    firmName,
    logo,
    firmType,
    city,
    rating,
    reviewsCount,
    professionalCount,
    practiceAreas = [],
    owner,
  } = firm;

  return (
    <Card hover className="flex h-full flex-col">
      <div className="flex items-start gap-4">
        <Avatar src={logo} name={firmName} size="lg" className="rounded-xl" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-slate-900">
            {firmName}
          </h3>
          {firmType && (
            <div className="mt-1">
              <Badge variant={firmType === 'Tax Firm' ? 'amber' : 'blue'}>
                {firmType}
              </Badge>
            </div>
          )}
          {owner && owner.name && (
            <p className="mt-1 text-xs text-slate-500">
              Owned by{' '}
              <span className="font-medium text-slate-700">{owner.name}</span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
        {city && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={14} className="text-slate-400" />
            {city}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Users size={14} className="text-slate-400" />
          {(professionalCount || 0) === 1
            ? t('firmCmp.professionalCountOne', {
                count: professionalCount || 0,
              })
            : t('firmCmp.professionalCountOther', {
                count: professionalCount || 0,
              })}
        </span>
      </div>

      <div className="mt-3">
        <RatingStars rating={rating || 0} count={reviewsCount || 0} size="sm" />
      </div>

      {practiceAreas.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {practiceAreas.slice(0, 3).map((area) => (
            <span
              key={area}
              className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
            >
              {area}
            </span>
          ))}
          {practiceAreas.length > 3 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
              {t('firmCmp.moreServices', { count: practiceAreas.length - 3 })}
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
          {t('firmCmp.viewFirm')}
        </Button>
      </div>
    </Card>
  );
}
