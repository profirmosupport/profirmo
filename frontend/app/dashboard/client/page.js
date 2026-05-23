'use client';

import { useCallback, useEffect, useState } from 'react';
import { Briefcase, CheckCircle2, Users, Search } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import StatsCard from '@/components/dashboard/StatsCard';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import { useLanguage } from '@/components/LanguageProvider';
import { useAuth } from '@/hooks/useAuth';
import caseService from '@/services/caseService';
import { ROLES } from '@/utils/constants';

export default function ClientDashboardPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await caseService.getMyClientCases();
      setCases(Array.isArray(data) ? data : []);
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeCases = cases.filter((c) => c.status !== 'closed').length;
  const closedCases = cases.filter((c) => c.status === 'closed').length;
  const totalCases = cases.length;
  const professionalsConsulted = new Set(
    cases.map((c) => c.professionalId).filter(Boolean)
  ).size;

  return (
    <DashboardLayout
      role={ROLES.CLIENT}
      title={t('dashClient.title')}
      subtitle={
        user && user.name
          ? t('dash.common.welcomeBackName', { name: user.name })
          : t('dash.common.welcomeBack')
      }
    >
      <div className="space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            label="Active cases"
            value={loading ? '…' : activeCases}
            icon={<Briefcase size={20} />}
            variant="blue"
            hint={`${totalCases} total`}
          />
          <StatsCard
            label="Closed cases"
            value={loading ? '…' : closedCases}
            icon={<CheckCircle2 size={20} />}
            variant="green"
          />
          <StatsCard
            label="Total cases"
            value={loading ? '…' : totalCases}
            icon={<Briefcase size={20} />}
            variant="amber"
          />
          <StatsCard
            label="Professionals consulted"
            value={loading ? '…' : professionalsConsulted}
            icon={<Users size={20} />}
            variant="slate"
            hint="Unique professionals across your cases"
          />
        </div>

        {/* Quick actions */}
        <Card>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Need help with a new matter?
              </h2>
              <p className="text-sm text-slate-500">
                Browse our verified professionals or law firms and book a
                consultation directly.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" href="/professionals">
                <Search size={15} />
                Find a professional
              </Button>
              <Button variant="outline" size="sm" href="/firms">
                Browse firms
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
