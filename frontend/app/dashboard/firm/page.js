'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  Briefcase,
  CheckCircle2,
  Star,
  CreditCard,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import StatsCard from '@/components/dashboard/StatsCard';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import EmptyState from '@/components/common/EmptyState';
import { useLanguage } from '@/components/LanguageProvider';
import { useAuth } from '@/hooks/useAuth';
import { getLawFirm, getLawFirmPayments } from '@/services/profileService';
import { formatINR } from '@/services/paymentService';
import { formatDate } from '@/utils/formatters';
import caseService from '@/services/caseService';
import reviewService from '@/services/reviewService';
import { ROLES } from '@/utils/constants';

const PAYMENT_STATUS_VARIANT = {
  created: 'amber',
  paid: 'green',
  failed: 'red',
  refunded: 'gray',
};

// Firm-level approval / lifecycle status, surfaced as a header chip
// next to the firm name. The backend exposes a few canonical strings
// (PENDING_APPROVAL / ACTIVE / REJECTED / MODIFICATIONS_REQUESTED /
// SUSPENDED) — we map each to a friendly label + Badge variant.
const FIRM_STATUS_LABEL = {
  ACTIVE: 'Active',
  PENDING_APPROVAL: 'Pending approval',
  MODIFICATIONS_REQUESTED: 'Changes requested',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
};
const FIRM_STATUS_VARIANT = {
  ACTIVE: 'green',
  PENDING_APPROVAL: 'amber',
  MODIFICATIONS_REQUESTED: 'amber',
  REJECTED: 'red',
  SUSPENDED: 'red',
};

export default function FirmDashboardPage() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [firm, setFirm] = useState(null);
  const [members, setMembers] = useState([]);
  const [cases, setCases] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentTotals, setPaymentTotals] = useState({
    gross: 0,
    markup: 0,
    net: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [firmRes, casesRes, paymentsRes] = await Promise.allSettled([
      getLawFirm(),
      caseService.getFirmCases(),
      getLawFirmPayments(),
    ]);

    if (paymentsRes.status === 'fulfilled' && paymentsRes.value) {
      setPayments(
        Array.isArray(paymentsRes.value.items) ? paymentsRes.value.items : []
      );
      setPaymentTotals(
        paymentsRes.value.totals || { gross: 0, markup: 0, net: 0 }
      );
    } else {
      setPayments([]);
      setPaymentTotals({ gross: 0, markup: 0, net: 0 });
    }

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

  const firmStatusKey =
    firm && firm.status ? String(firm.status).toUpperCase() : null;
  const firmStatusLabel = firmStatusKey
    ? FIRM_STATUS_LABEL[firmStatusKey] || firmStatusKey
    : null;
  const firmStatusVariant = firmStatusKey
    ? FIRM_STATUS_VARIANT[firmStatusKey] || 'gray'
    : 'gray';
  const firmNameText =
    firm && firm.firmName
      ? t('dashFirm.titleNamed', { name: firm.firmName })
      : t('dashFirm.title');
  const headerTitle = firmStatusLabel ? (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="truncate">{firmNameText}</span>
      <Badge variant={firmStatusVariant} className="shrink-0 text-[10px] uppercase tracking-wide">
        {firmStatusLabel}
      </Badge>
    </span>
  ) : (
    firmNameText
  );

  return (
    <DashboardLayout
      role={ROLES.FIRM_ADMIN}
      title={headerTitle}
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

        {/* Collective payments across every member professional. */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <CreditCard size={18} className="text-amber-600" />
                Firm payments
              </h2>
              <p className="text-xs text-slate-500">
                Every Razorpay payment received by your firm's professionals.
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-right text-xs">
              <div>
                <p className="uppercase tracking-wide text-slate-400">Gross</p>
                <p className="text-sm font-semibold text-slate-800">
                  {formatINR(paymentTotals.gross)}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-wide text-slate-400">Markup</p>
                <p className="text-sm font-semibold text-rose-600">
                  −{formatINR(paymentTotals.markup)}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-wide text-slate-400">
                  Net to firm
                </p>
                <p className="text-sm font-semibold text-emerald-700">
                  {formatINR(paymentTotals.net)}
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-14 w-full animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <EmptyState
              icon={<CreditCard size={24} />}
              title="No payments yet"
              description="When your professionals receive paid bookings, they'll show up here."
            />
          ) : (
            <Card padding={false}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">When</th>
                      <th className="px-4 py-3 font-semibold">Professional</th>
                      <th className="px-4 py-3 font-semibold">Payer</th>
                      <th className="px-4 py-3 font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">Markup</th>
                      <th className="px-4 py-3 font-semibold">Net</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(p.capturedAt || p.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {p.professionalName || '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {p.payerName || '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {formatINR(p.amount)}
                        </td>
                        <td className="px-4 py-3 text-rose-600">
                          {p.platformFee > 0
                            ? `−${formatINR(p.platformFee)}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-emerald-700">
                          {formatINR(p.netAmount || 0)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={PAYMENT_STATUS_VARIANT[p.status] || 'gray'}
                          >
                            {p.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
