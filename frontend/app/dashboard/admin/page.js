'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  UserCheck,
  Building2,
  CalendarClock,
  Wallet,
  ShieldCheck,
  Check,
  X,
  Flag,
  FileText,
  ArrowRight,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import StatsCard from '@/components/dashboard/StatsCard';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import EmptyState from '@/components/common/EmptyState';
import { useDashboard } from '@/hooks/useDashboard';
import { ROLES } from '@/utils/constants';
import { formatCurrency, formatDate, getInitials } from '@/utils/formatters';

const CMS_LINKS = [
  { label: 'About page', href: '/about' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Contact', href: '/contact' },
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
];

function SectionTitle({ title, description }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && <p className="text-sm text-slate-500">{description}</p>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const dashboard = useDashboard(ROLES.PLATFORM_ADMIN);
  const stats = dashboard.stats || {};

  const [pending, setPending] = useState(
    () => dashboard.pendingProfessionals || []
  );

  function resolve(id) {
    setPending((list) => list.filter((p) => p.id !== id));
  }

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="Platform admin"
      subtitle="Operations overview for Profirmo"
    >
      <div className="space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatsCard
            label="Total clients"
            value={stats.totalClients || 0}
            icon={<Users size={20} />}
            variant="blue"
          />
          <StatsCard
            label="Professionals"
            value={stats.totalProfessionals || 0}
            icon={<UserCheck size={20} />}
            variant="green"
            hint={`${stats.pendingApprovals || 0} pending`}
          />
          <StatsCard
            label="Firms"
            value={stats.totalFirms || 0}
            icon={<Building2 size={20} />}
            variant="amber"
          />
          <StatsCard
            label="Total bookings"
            value={stats.totalBookings || 0}
            icon={<CalendarClock size={20} />}
            variant="slate"
          />
          <StatsCard
            label="Platform revenue"
            value={formatCurrency(stats.platformRevenue || 0)}
            icon={<Wallet size={20} />}
            variant="green"
            hint="Completed bookings"
          />
        </div>

        {/* Pending approvals */}
        <section>
          <SectionTitle
            title="Pending professional approvals"
            description="Review and verify new professionals before they go live."
          />
          {pending.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck size={24} />}
              title="All caught up"
              description="There are no professionals awaiting approval."
            />
          ) : (
            <div className="space-y-3">
              {pending.map((pro) => (
                <Card key={pro.id}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-semibold text-white">
                        {getInitials(pro.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-800">
                            {pro.name}
                          </p>
                          <Badge variant="amber">Pending</Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                          {pro.professionType} · {pro.city} ·{' '}
                          {pro.experience} yrs
                        </p>
                        <p className="text-xs text-slate-400">
                          Reg. {pro.registrationNumber} · Applied{' '}
                          {formatDate(pro.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => resolve(pro.id)}
                      >
                        <Check size={15} />
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => resolve(pro.id)}
                      >
                        <X size={15} />
                        Reject
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Reported reviews + revenue */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <SectionTitle title="Reported reviews" />
            <Card>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Flag size={22} />
                </span>
                <p className="text-sm font-medium text-slate-700">
                  No reported reviews
                </p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  Flagged or disputed reviews will appear here for moderation.
                </p>
              </div>
            </Card>
          </div>
          <div>
            <SectionTitle title="Revenue" />
            <Card>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Wallet size={22} />
                </span>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(stats.platformRevenue || 0)}
                </p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  Detailed revenue analytics and payout reports will be
                  available here soon.
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* CMS management */}
        <section>
          <SectionTitle
            title="CMS management"
            description="Manage the platform's public marketing pages."
          />
          <Card>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CMS_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <FileText size={15} className="text-slate-400" />
                    {link.label}
                  </span>
                  <ArrowRight size={15} className="text-slate-400" />
                </Link>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
