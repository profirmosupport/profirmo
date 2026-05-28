'use client';

import { MapPin, BadgeCheck, Briefcase, Video, Users2 } from 'lucide-react';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import Avatar from '@/components/common/Avatar';
import RatingStars from '@/components/common/RatingStars';
import { useLanguage } from '@/components/LanguageProvider';
import { useLocations } from '@/hooks/useLocations';
import { formatCurrency, slugify } from '@/utils/formatters';

/**
 * ProfessionalCard — summary card for a single professional.
 * Renders the API shape: name, professionalType, subCategories, city,
 * practiceCities, profilePhoto, yearsOfExperience, consultationFee, rating,
 * reviewsCount, availableNow, verified.
 *
 * Props: { professional }
 */
export default function ProfessionalCard({ professional }) {
  const { t } = useLanguage();
  const { cityById } = useLocations();
  if (!professional) return null;

  const {
    id,
    name,
    professionalType,
    subCategories,
    city,
    practiceCities,
    profilePhoto,
    yearsOfExperience,
    rating,
    reviewsCount,
    consultationFee,
    availableNow,
    verified,
    bio,
    languages,
    consultancyType,
  } = professional;

  // Friendly label for the consultancyType enum.
  const consultancyLabel =
    consultancyType === 'online'
      ? 'Online'
      : consultancyType === 'in_person'
        ? 'In Person'
        : consultancyType === 'both'
          ? 'Online · In Person'
          : '';

  // Two-line bio preview so cards stay a fixed height.
  const bioPreview = (() => {
    const text = String(bio || '').trim();
    if (!text) return '';
    if (text.length <= 140) return text;
    return `${text.slice(0, 137)}…`;
  })();

  // First two admin-managed sub-categories surface under the name. The rest
  // are summarised as "+N" so the card stays a fixed height.
  const subs = Array.isArray(subCategories) ? subCategories : [];
  const visibleSubs = subs.slice(0, 2);
  const extraSubsCount = Math.max(0, subs.length - visibleSubs.length);

  // practiceCities holds city IDs (post-hierarchy migration) or, for legacy
  // rows, raw city names. Resolve each to a display name so the card never
  // leaks an internal id, then de-dupe against the base `city` (also a name).
  const practiceNames = (Array.isArray(practiceCities) ? practiceCities : [])
    .filter(Boolean)
    .map((c) => {
      if (typeof c === 'string' && c.startsWith('city-')) {
        const found = cityById(c);
        return found ? found.name : null;
      }
      return String(c);
    })
    .filter(Boolean);
  const otherPractice = practiceNames.filter(
    (c) => c.toLowerCase() !== String(city || '').toLowerCase()
  );

  return (
    <Card hover className="flex h-full flex-col">
      <div className="flex items-start gap-4">
        <Avatar src={profilePhoto} name={name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-base font-semibold text-slate-900">
              {name}
            </h3>
            {verified && (
              <BadgeCheck
                size={16}
                className="shrink-0 text-blue-600"
                aria-label={t('profCmp.verified')}
              />
            )}
          </div>
          <p className="mt-0.5 truncate text-sm font-medium text-blue-700">
            {professionalType}
          </p>
          {visibleSubs.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {visibleSubs.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200"
                >
                  {s.name}
                </span>
              ))}
              {extraSubsCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  +{extraSubsCount}
                </span>
              )}
            </div>
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
          <Briefcase size={14} className="text-slate-400" />
          {t('profCmp.yrsExp', { count: yearsOfExperience || 0 })}
        </span>
        {consultancyLabel && (
          <span className="inline-flex items-center gap-1">
            {consultancyType === 'in_person' ? (
              <Users2 size={14} className="text-slate-400" />
            ) : (
              <Video size={14} className="text-slate-400" />
            )}
            {consultancyLabel}
          </span>
        )}
      </div>

      {Array.isArray(languages) && languages.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          {languages.slice(0, 4).map((lang) => (
            <span
              key={lang}
              className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600"
            >
              {lang}
            </span>
          ))}
        </div>
      )}

      {bioPreview && (
        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          {bioPreview}
        </p>
      )}

      {otherPractice.length > 0 && (
        <p className="mt-2 truncate text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1 font-medium text-slate-400">
            <MapPin size={11} />
            Also practises in
          </span>{' '}
          <span className="font-medium text-teal-700">
            {otherPractice.join(', ')}
          </span>
        </p>
      )}

      <div className="mt-3">
        <RatingStars rating={rating || 0} count={reviewsCount || 0} size="sm" />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <div>
          <p className="text-base font-semibold text-slate-900">
            {formatCurrency(consultationFee)}
          </p>
          <p className="text-xs text-slate-400">
            {t('profCmp.consultationRate')}
          </p>
        </div>
        {availableNow ? (
          <Badge variant="green">{t('profCmp.availableNow')}</Badge>
        ) : (
          <Badge variant="gray">{t('profCmp.offline')}</Badge>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          href={`/professionals/${id}${
            slugify(name) ? `/${slugify(name)}` : ''
          }`}
          variant="outline"
          size="sm"
          className="flex-1"
        >
          {t('profCmp.viewProfile')}
        </Button>
        <Button
          href={`/booking/${id}`}
          variant="primary"
          size="sm"
          className="flex-1"
        >
          {t('profCmp.bookNow')}
        </Button>
      </div>
    </Card>
  );
}
