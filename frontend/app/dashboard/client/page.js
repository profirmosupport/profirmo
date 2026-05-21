'use client';

import Link from 'next/link';
import {
  CalendarClock,
  Briefcase,
  CheckCircle2,
  Wallet,
  CreditCard,
  Settings,
  ArrowRight,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import StatsCard from '@/components/dashboard/StatsCard';
import ConsultationTable from '@/components/dashboard/ConsultationTable';
import CaseTable from '@/components/dashboard/CaseTable';
import FileManager from '@/components/dashboard/FileManager';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import RatingStars from '@/components/common/RatingStars';
import { useAuth } from '@/hooks/useAuth';
import { useDashboard } from '@/hooks/useDashboard';
import { ROLES } from '@/utils/constants';
import { formatCurrency, formatRate, getInitials } from '@/utils/formatters';
import { professionals } from '@/data/mockData';

function SectionTitle({ title, description, action }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="text-sm text-slate-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export default function ClientDashboardPage() {
  const { user } = useAuth();
  const linkedId = user ? user.linkedId || user.firmId : undefined;
  const dashboard = useDashboard(ROLES.CLIENT, linkedId);

  const stats = dashboard.stats || {};
  const consultations = dashboard.consultations || [];
  const cases = dashboard.cases || [];

  const upcoming = consultations.filter(
    (c) => c.callStatus === 'scheduled' || c.callStatus === 'ongoing'
  );
  const past = consultations.filter((c) => c.callStatus === 'ended');
  const favorites = professionals.slice(0, 3);
  const caseFiles = cases.flatMap((c) => c.files || []);

  return (
    <DashboardLayout
      role={ROLES.CLIENT}
      title="Client dashboard"
      subtitle={`Welcome back${user && user.name ? `, ${user.name}` : ''}`}
    >
      <div className="space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            label="Upcoming bookings"
            value={stats.upcomingBookings || 0}
            icon={<CalendarClock size={20} />}
            variant="blue"
            hint="Confirmed & pending"
          />
          <StatsCard
            label="Active cases"
            value={stats.activeCases || 0}
            icon={<Briefcase size={20} />}
            variant="amber"
            hint="Currently in progress"
          />
          <StatsCard
            label="Completed consultations"
            value={stats.completedConsultations || 0}
            icon={<CheckCircle2 size={20} />}
            variant="green"
          />
          <StatsCard
            label="Total spent"
            value={formatCurrency(stats.totalSpent || 0)}
            icon={<Wallet size={20} />}
            variant="slate"
            hint="Across completed bookings"
          />
        </div>

        {/* Upcoming consultations */}
        <section>
          <SectionTitle
            title="Upcoming consultations"
            description="Sessions that are scheduled or currently live."
            action={
              <Button variant="outline" size="sm" href="/professionals">
                Book new
              </Button>
            }
          />
          <ConsultationTable
            consultations={upcoming}
            emptyTitle="No upcoming consultations"
            emptyDescription="Book a consultation with a professional to get started."
          />
        </section>

        {/* Past consultations */}
        <section>
          <SectionTitle
            title="Past consultations"
            description="Your completed consultation history."
          />
          <ConsultationTable
            consultations={past}
            emptyTitle="No past consultations"
            emptyDescription="Completed consultations will appear here."
          />
        </section>

        {/* Favorites + payments */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionTitle
              title="Favorite professionals"
              description="Quickly rebook the experts you trust."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {favorites.map((pro) => (
                <Card key={pro.id} hover>
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                      {getInitials(pro.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800">
                        {pro.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {pro.professionType} · {pro.city}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <RatingStars
                          rating={pro.rating}
                          count={pro.reviewsCount}
                          size="sm"
                        />
                        <span className="text-xs font-medium text-slate-700">
                          {formatRate(pro.perMinuteRate)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    href={`/professionals/${pro.id}`}
                  >
                    View profile
                  </Button>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <SectionTitle title="Payment history" />
            <Card>
              <div className="flex h-full flex-col items-center justify-center py-8 text-center">
                <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <CreditCard size={22} />
                </span>
                <p className="text-sm font-medium text-slate-700">
                  Payments & invoices
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Detailed receipts and invoices will be available here soon.
                </p>
                <Button variant="ghost" size="sm" className="mt-3" disabled>
                  Download statement
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Documents */}
        <section>
          <SectionTitle
            title="Uploaded documents"
            description="Files you have shared for your consultations."
          />
          <FileManager files={caseFiles} />
        </section>

        {/* Cases */}
        <section>
          <SectionTitle
            title="Cases shared with professionals"
            description="Track the status of every matter you have opened."
          />
          <CaseTable cases={cases} />
        </section>

        {/* Profile settings */}
        <section>
          <SectionTitle title="Profile settings" />
          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-base font-semibold text-white">
                  {getInitials(user && user.name ? user.name : 'Guest')}
                </span>
                <div>
                  <p className="font-medium text-slate-800">
                    {user && user.name ? user.name : 'Guest user'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {user && user.email ? user.email : 'Not signed in'}
                  </p>
                  <Badge variant="blue" className="mt-1">
                    Client account
                  </Badge>
                </div>
              </div>
              <Button variant="outline" size="sm">
                <Settings size={15} />
                Manage settings
              </Button>
            </div>
          </Card>
        </section>

        <div className="flex justify-center">
          <Link
            href="/professionals"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Explore more professionals
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
