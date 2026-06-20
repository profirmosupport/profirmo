'use client';

import { useState } from 'react';
import { MapPin, Users, Mail, Phone, Globe, CalendarDays } from 'lucide-react';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import Avatar from '@/components/common/Avatar';
import RatingStars from '@/components/common/RatingStars';
import ContactFirmModal from '@/components/firms/ContactFirmModal';
import { useLanguage } from '@/components/LanguageProvider';

// Mask "user@example.com" → "u***@example.com" so the email isn't scraped off
// the public page but the visitor still sees it's a real address.
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const at = email.indexOf('@');
  if (at < 1) return '••••@••••';
  const user = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = user.slice(0, Math.min(1, user.length));
  return `${visible}${'•'.repeat(Math.max(3, user.length - 1))}@${domain}`;
}

// Mask phone digits, keeping the last two visible so the firm can verify
// callbacks but the full number isn't harvestable from the page source.
function maskPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 4) return '•'.repeat(digits.length || 4);
  const tail = digits.slice(-2);
  return `${'•'.repeat(digits.length - 2)}${tail}`;
}

/**
 * FirmProfileHeader — large header panel on a firm profile.
 * Uses the API detail shape: firmName, logo, firmType, city, about,
 * contactEmail, contactNumber, website, establishedYear, professionalCount.
 *
 * Props: { firm }
 */
export default function FirmProfileHeader({ firm }) {
  const { t } = useLanguage();
  const [contactOpen, setContactOpen] = useState(false);
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
            priority
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
                <span
                  className="inline-flex items-center gap-1.5"
                  title="Use the Contact firm button to reach this firm"
                >
                  <Mail size={13} className="text-slate-400" />
                  {maskEmail(contactEmail)}
                </span>
              )}
              {contactNumber && (
                <span
                  className="inline-flex items-center gap-1.5"
                  title="Use the Contact firm button to reach this firm"
                >
                  <Phone size={13} className="text-slate-400" />
                  {maskPhone(contactNumber)}
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
            variant="primary"
            size="md"
            className="w-full"
            onClick={() => setContactOpen(true)}
          >
            {t('firmCmp.contactFirm')}
          </Button>
          <p className="mt-2 text-center text-xs text-slate-400">
            {t('firmCmp.respondsWithinDay')}
          </p>
        </div>
      </div>
      <ContactFirmModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        firm={firm}
      />
    </Card>
  );
}
