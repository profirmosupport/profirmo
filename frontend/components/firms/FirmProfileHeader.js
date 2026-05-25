'use client';

import { MapPin, Users, Mail, Phone, Globe, CalendarDays } from 'lucide-react';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import Avatar from '@/components/common/Avatar';
import RatingStars from '@/components/common/RatingStars';
import { useLanguage } from '@/components/LanguageProvider';

/**
 * FirmProfileHeader — large header panel on a firm profile.
 * Uses the API detail shape: firmName, logo, firmType, city, about,
 * contactEmail, contactNumber, website, establishedYear, professionalCount.
 *
 * Props: { firm }
 */
export default function FirmProfileHeader({ firm }) {
  const { t } = useLanguage();
  if (!firm) return null;

  const {
    firmName,
    logo,
    firmType,
    city,
    about,
    contactEmail,
    contactNumber,
    website,
    establishedYear,
    rating,
    reviewsCount,
    professionalCount,
    numberOfProfessionals,
    owner,
  } = firm;

  // Prefer the self-declared headcount (entered while creating / editing
  // the firm). Fall back to the derived count of active FirmMember rows.
  const displayedCount =
    numberOfProfessionals !== null && numberOfProfessionals !== undefined
      ? numberOfProfessionals
      : professionalCount || 0;

  return (
    <Card>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar
            src={logo}
            name={firmName}
            size="xl"
            className="rounded-2xl"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{firmName}</h1>
              {firmType && (
                <Badge variant={firmType === 'Tax Firm' ? 'amber' : 'blue'}>
                  {firmType}
                </Badge>
              )}
            </div>

            {owner && owner.name && (
              <div className="mt-2 flex items-center gap-2">
                <Avatar
                  src={owner.profilePhoto}
                  name={owner.name}
                  size="sm"
                />
                <span className="text-sm font-medium text-slate-700">
                  {owner.name}
                </span>
                <Badge variant="green">Owner</Badge>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
              {city && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={15} className="text-slate-400" />
                  {city}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Users size={15} className="text-slate-400" />
                {displayedCount === 1
                  ? t('firmCmp.professionalCountOne', { count: displayedCount })
                  : t('firmCmp.professionalCountOther', { count: displayedCount })}
              </span>
              {establishedYear && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={15} className="text-slate-400" />
                  Est. {establishedYear}
                </span>
              )}
              <RatingStars
                rating={rating || 0}
                count={reviewsCount || 0}
                size="sm"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500">
              {contactEmail && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={13} className="text-slate-400" />
                  {contactEmail}
                </span>
              )}
              {contactNumber && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={13} className="text-slate-400" />
                  {contactNumber}
                </span>
              )}
              {website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700"
                >
                  <Globe size={13} />
                  {website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>

            {about && (
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">
                {about}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 lg:w-56">
          <Button
            href={contactEmail ? `mailto:${contactEmail}` : '/contact'}
            variant="primary"
            size="md"
            className="w-full"
          >
            {t('firmCmp.contactFirm')}
          </Button>
          <p className="mt-2 text-center text-xs text-slate-400">
            {t('firmCmp.respondsWithinDay')}
          </p>
        </div>
      </div>
    </Card>
  );
}
