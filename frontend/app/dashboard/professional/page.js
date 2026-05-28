'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, CheckCircle2, Users, Star } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import StatsCard from '@/components/dashboard/StatsCard';
import AvailabilityManager from '@/components/dashboard/AvailabilityManager';
import Card from '@/components/common/Card';
import { useLanguage } from '@/components/LanguageProvider';
import { useAuth } from '@/hooks/useAuth';
import reviewService from '@/services/reviewService';
import caseService from '@/services/caseService';
import professionalService from '@/services/professionalService';
import { getProfile } from '@/services/profileService';
import { ROLES } from '@/utils/constants';

export default function ProfessionalDashboardPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const linkedId = user ? user.linkedId || user.firmId : undefined;

  // Live data: reviews (for rating stat), assigned cases, and the caller's
  // own professional record (for availability / rate).
  const [myReviews, setMyReviews] = useState([]);
  const [myCases, setMyCases] = useState([]);
  const [myProfessional, setMyProfessional] = useState(null);
  // `profileCompletion` is computed server-side using the 10% photo +
  // 3×30% steps model, so the dashboard widget stays in sync with the
  // wizard's view of "what's left to fill in".
  const [profileCompletion, setProfileCompletion] = useState(0);

  const loadProfessional = useCallback(async () => {
    if (!linkedId) return;
    try {
      const data = await professionalService.getById(linkedId);
      if (data && data.id) setMyProfessional(data);
    } catch {
      // Ignore — availability manager falls back to an empty schedule.
    }
    try {
      const profile = await getProfile();
      if (profile && typeof profile.profileCompletion === 'number') {
        setProfileCompletion(profile.profileCompletion);
      }
    } catch {
      // Ignore — dashboard widget just shows 0% if the call fails.
    }
  }, [linkedId]);

  useEffect(() => {
    loadProfessional();
  }, [loadProfessional]);

  const loadStats = useCallback(async () => {
    const [reviewsRes, casesRes] = await Promise.allSettled([
      reviewService.getMine(),
      caseService.getMyCases(),
    ]);
    setMyReviews(
      reviewsRes.status === 'fulfilled' && Array.isArray(reviewsRes.value)
        ? reviewsRes.value
        : []
    );
    setMyCases(
      casesRes.status === 'fulfilled' && Array.isArray(casesRes.value)
        ? casesRes.value
        : []
    );
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Public rating / count derived from real, published reviews.
  const publishedReviews = useMemo(
    () => myReviews.filter((r) => r.status !== 'UNDER_APPEAL'),
    [myReviews]
  );
  const realReviewCount = publishedReviews.length;
  const realAvgRating =
    realReviewCount > 0
      ? publishedReviews.reduce(
          (sum, r) => sum + (Number(r.rating) || 0),
          0
        ) / realReviewCount
      : 0;

  // Case-derived stats.
  const activeCases = myCases.filter((c) => c.status !== 'closed').length;
  const closedCases = myCases.filter((c) => c.status === 'closed').length;
  const uniqueClientCount = new Set(
    myCases.map((c) => c.clientId).filter(Boolean)
  ).size;

  const professional = myProfessional || {};

  const completion = profileCompletion;

  return (
    <DashboardLayout
      role={ROLES.PROFESSIONAL}
      title={t('dashPro.title')}
      subtitle={
        user && user.name
          ? t('dash.common.welcomeBackName', { name: user.name })
          : t('dash.common.welcomeBack')
      }
    >
      <div className="space-y-8">
        {/* Profile completion */}
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {t('dashPro.completion.title')}
              </h2>
              <p className="text-sm text-slate-500">
                {t('dashPro.completion.desc')}
              </p>
            </div>
            <span className="text-2xl font-bold text-blue-600">
              {completion}%
            </span>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
        </Card>

        {/* Availability */}
        <AvailabilityManager
          professional={professional}
          onSaved={loadProfessional}
        />

        {/* Earnings & performance */}
        <section>
          <div className="mb-3">
            <h2 className="text-base font-semibold text-slate-900">
              {t('dashPro.earnings.title')}
            </h2>
            <p className="text-sm text-slate-500">
              {t('dashPro.earnings.desc')}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              label="Active cases"
              value={activeCases}
              icon={<Briefcase size={20} />}
              variant="blue"
              hint={`${myCases.length} total assigned`}
            />
            <StatsCard
              label="Closed cases"
              value={closedCases}
              icon={<CheckCircle2 size={20} />}
              variant="green"
            />
            <StatsCard
              label="Clients"
              value={uniqueClientCount}
              icon={<Users size={20} />}
              variant="amber"
              hint="Unique clients across your cases"
            />
            <StatsCard
              label={t('dashPro.stat.averageRating')}
              value={realAvgRating.toFixed(1)}
              icon={<Star size={20} />}
              variant="amber"
              hint={t('dashPro.stat.reviewsCount', {
                count: realReviewCount,
              })}
            />
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
