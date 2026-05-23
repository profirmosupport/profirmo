'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users, UserCheck, Briefcase, CheckCircle2, Star } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import StatsCard from '@/components/dashboard/StatsCard';
import { useLanguage } from '@/components/LanguageProvider';
import { useAuth } from '@/hooks/useAuth';
import { getLawFirm } from '@/services/profileService';
import caseService from '@/services/caseService';
import reviewService from '@/services/reviewService';
import { ROLES } from '@/utils/constants';

export default function FirmDashboardPage() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [firm, setFirm] = useState(null);
  const [members, setMembers] = useState([]);
  const [cases, setCases] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [firmRes, casesRes] = await Promise.allSettled([
      getLawFirm(),
      caseService.getFirmCases(),
    ]);

    let firmObj = null;
    let memberList = [];
    if (firmRes.status === 'fulfilled' && firmRes.value) {
      firmObj = firmRes.value.lawFirm || null;
      memberList = Array.isArray(firmRes.value.members)
        ? firmRes.value.members
        : [];
    }
    setFirm(firmObj);
    setMembers(memberList);

    const firmCasesPayload =
      casesRes.status === 'fulfilled' ? casesRes.value : null;
    setCases(
      firmCasesPayload && Array.isArray(firmCasesPayload.items)
        ? firmCasesPayload.items
        : []
    );

    // Collective review count — pull reviews for the firm via the public id.
    const publicFirmId =
      (firmObj && (firmObj.legacyFirmId || firmObj.id)) ||
      (firmCasesPayload && firmCasesPayload.firmId) ||
      user?.linkedId ||
      user?.firmId ||
      null;
    if (publicFirmId) {
      try {
        const r = await reviewService.getByFirm(publicFirmId);
        setReviews(Array.isArray(r) ? r : []);
      } catch {
        setReviews([]);
      }
    } else {
      setReviews([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const totalProfessionals = members.length;
  const activeCases = cases.filter((c) => c.status !== 'closed').length;
  const totalCases = cases.length;
  const uniqueClientCount = new Set(
    cases.map((c) => c.clientId).filter(Boolean)
  ).size;
  const publishedReviews = reviews.filter(
    (r) => !r.status || r.status === 'PUBLISHED'
  );
  const reviewsCount = publishedReviews.length;
  const avgRating =
    reviewsCount > 0
      ? publishedReviews.reduce(
          (sum, r) => sum + (Number(r.rating) || 0),
          0
        ) / reviewsCount
      : 0;

  return (
    <DashboardLayout
      role={ROLES.FIRM_ADMIN}
      title={
        firm && firm.firmName
          ? t('dashFirm.titleNamed', { name: firm.firmName })
          : t('dashFirm.title')
      }
      subtitle={t('dashFirm.subtitle')}
    >
      <div className="space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatsCard
            label={t('dashFirm.stat.professionals')}
            value={loading ? '…' : totalProfessionals}
            icon={<Users size={20} />}
            variant="blue"
            hint="Including the owner"
          />
          <StatsCard
            label={t('dashFirm.stat.clients')}
            value={loading ? '…' : uniqueClientCount}
            icon={<UserCheck size={20} />}
            variant="green"
            hint="Unique clients across firm cases"
          />
          <StatsCard
            label={t('dashFirm.stat.totalCases')}
            value={loading ? '…' : totalCases}
            icon={<Briefcase size={20} />}
            variant="amber"
            hint={t('dashFirm.stat.activeCases', { count: activeCases })}
          />
          <StatsCard
            label="Closed cases"
            value={loading ? '…' : totalCases - activeCases}
            icon={<CheckCircle2 size={20} />}
            variant="slate"
          />
          <StatsCard
            label="Avg. review rating"
            value={loading ? '…' : avgRating.toFixed(1)}
            icon={<Star size={20} />}
            variant="amber"
            hint={`${reviewsCount} review${reviewsCount === 1 ? '' : 's'}`}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
