'use client';

import {
  Info,
  Hash,
  Users,
  CalendarDays,
  FileText,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  Youtube,
  Globe,
} from 'lucide-react';
import Card from '@/components/common/Card';
import { resolveFileUrl } from '@/services/fileService';

const SOCIAL_ICON = {
  linkedin: Linkedin,
  twitter: Twitter,
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
};

const SOCIAL_LABEL = {
  linkedin: 'LinkedIn',
  twitter: 'Twitter',
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
};

function DocLink({ label, url }) {
  if (!url) return null;
  const href = resolveFileUrl(url) || url;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
    >
      <FileText size={14} className="text-slate-400" />
      {label}
    </a>
  );
}

/**
 * FirmAboutDetails — additional firm-level information that does not fit in
 * the header card: registration / employees / established year, document
 * links, and social-media links. Renders nothing when there is no data.
 */
export default function FirmAboutDetails({ firm }) {
  if (!firm) return null;

  const {
    registrationNumber,
    totalEmployees,
    numberOfProfessionals,
    establishedYear,
    website,
    registrationCertificate,
    businessLicense,
    taxDocuments,
    socialLinks,
  } = firm;

  const hasFacts =
    registrationNumber ||
    totalEmployees ||
    numberOfProfessionals ||
    establishedYear ||
    website;
  const hasDocs =
    registrationCertificate ||
    businessLicense ||
    (Array.isArray(taxDocuments) && taxDocuments.length > 0);

  const socialEntries = Object.entries(socialLinks || {}).filter(
    ([, url]) => url && String(url).trim()
  );
  const hasSocial = socialEntries.length > 0;

  if (!hasFacts && !hasDocs && !hasSocial) return null;

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Info size={18} className="text-blue-600" />
        <h2 className="text-base font-semibold text-slate-900">Firm details</h2>
      </div>

      {hasFacts && (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {registrationNumber && (
            <div className="flex items-start gap-2">
              <Hash size={15} className="mt-0.5 text-slate-400" />
              <div>
                <dt className="text-xs text-slate-500">Registration number</dt>
                <dd className="text-sm font-medium text-slate-800">
                  {registrationNumber}
                </dd>
              </div>
            </div>
          )}
          {numberOfProfessionals ? (
            <div className="flex items-start gap-2">
              <Users size={15} className="mt-0.5 text-slate-400" />
              <div>
                <dt className="text-xs text-slate-500">
                  Number of professionals
                </dt>
                <dd className="text-sm font-medium text-slate-800">
                  {numberOfProfessionals}
                </dd>
              </div>
            </div>
          ) : null}
          {totalEmployees ? (
            <div className="flex items-start gap-2">
              <Users size={15} className="mt-0.5 text-slate-400" />
              <div>
                <dt className="text-xs text-slate-500">Total employees</dt>
                <dd className="text-sm font-medium text-slate-800">
                  {totalEmployees}
                </dd>
              </div>
            </div>
          ) : null}
          {establishedYear ? (
            <div className="flex items-start gap-2">
              <CalendarDays size={15} className="mt-0.5 text-slate-400" />
              <div>
                <dt className="text-xs text-slate-500">Established</dt>
                <dd className="text-sm font-medium text-slate-800">
                  {establishedYear}
                </dd>
              </div>
            </div>
          ) : null}
          {website && (
            <div className="flex items-start gap-2">
              <Globe size={15} className="mt-0.5 text-slate-400" />
              <div>
                <dt className="text-xs text-slate-500">Website</dt>
                <dd className="truncate text-sm font-medium">
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700"
                  >
                    {website.replace(/^https?:\/\//, '')}
                  </a>
                </dd>
              </div>
            </div>
          )}
        </dl>
      )}

      {hasDocs && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Documents
          </h3>
          <div className="flex flex-wrap gap-2">
            <DocLink
              label="Registration certificate"
              url={registrationCertificate}
            />
            <DocLink label="Business license" url={businessLicense} />
            {Array.isArray(taxDocuments) &&
              taxDocuments.map((u, i) => (
                <DocLink key={u} label={`Tax document ${i + 1}`} url={u} />
              ))}
          </div>
        </div>
      )}

      {hasSocial && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Social media
          </h3>
          <div className="flex flex-wrap gap-2">
            {socialEntries.map(([key, url]) => {
              const Icon = SOCIAL_ICON[key] || Globe;
              const label = SOCIAL_LABEL[key] || key;
              return (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700"
                >
                  <Icon size={14} />
                  {label}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
