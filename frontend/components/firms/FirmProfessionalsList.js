'use client';

import Link from 'next/link';
import { Users, BadgeCheck } from 'lucide-react';
import Card from '@/components/common/Card';
import Avatar from '@/components/common/Avatar';
import EmptyState from '@/components/common/EmptyState';
import { useLanguage } from '@/components/LanguageProvider';

/**
 * FirmProfessionalsList — grid of professionals / members belonging to a firm.
 * Uses the API firm-detail shape: `members:[{ name, role, professionalType,
 * id?, profilePhoto?, verified? }]`.
 *
 * Props: { firm }
 */
export default function FirmProfessionalsList({ firm }) {
  const { t } = useLanguage();
  const members =
    firm && Array.isArray(firm.members) ? firm.members : [];

  return (
    <Card>
      <div className="mb-5 flex items-center gap-2">
        <Users size={18} className="text-blue-600" />
        <h2 className="text-base font-semibold text-slate-900">
          {t('firmCmp.professionalsAtFirm')}
        </h2>
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={<Users size={24} />}
          title={t('firmCmp.noProfessionalsTitle')}
          description={t('firmCmp.noProfessionalsDesc')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {members.map((member, index) => {
            const cardInner = (
              <div className="flex items-start gap-3">
                <Avatar
                  src={member.profilePhoto}
                  name={member.name}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-sm font-semibold text-slate-900">
                      {member.name}
                    </h3>
                    {member.verified && (
                      <BadgeCheck
                        size={14}
                        className="shrink-0 text-blue-600"
                        aria-label={t('firmCmp.verified')}
                      />
                    )}
                  </div>
                  {member.professionalType && (
                    <p className="truncate text-xs font-medium text-blue-700">
                      {member.professionalType}
                    </p>
                  )}
                  {member.role && (
                    <p className="truncate text-xs capitalize text-slate-500">
                      {String(member.role).replace(/_/g, ' ')}
                    </p>
                  )}
                </div>
              </div>
            );

            const key = member.id || `${member.name}-${index}`;

            if (member.professionalId) {
              return (
                <Link
                  key={key}
                  href={`/professionals/${member.professionalId}`}
                  className="flex flex-col rounded-xl border border-slate-200 p-4 transition-colors hover:border-amber-300"
                >
                  {cardInner}
                </Link>
              );
            }

            return (
              <div
                key={key}
                className="flex flex-col rounded-xl border border-slate-200 p-4"
              >
                {cardInner}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
