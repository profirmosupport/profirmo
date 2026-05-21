'use client';

import {
  CalendarClock,
  Briefcase,
  CheckCircle2,
  Wallet,
  Star,
  Video,
  FileText,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import StatsCard from '@/components/dashboard/StatsCard';
import AvailabilityManager from '@/components/dashboard/AvailabilityManager';
import ConsultationTable from '@/components/dashboard/ConsultationTable';
import ClientTable from '@/components/dashboard/ClientTable';
import CaseTable from '@/components/dashboard/CaseTable';
import FileManager from '@/components/dashboard/FileManager';
import ReviewManager from '@/components/dashboard/ReviewManager';
import Card from '@/components/common/Card';
import { useAuth } from '@/hooks/useAuth';
import { useDashboard } from '@/hooks/useDashboard';
import { ROLES } from '@/utils/constants';
import { formatCurrency } from '@/utils/formatters';
import { professionals, clients } from '@/data/mockData';

function SectionTitle({ title, description }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && <p className="text-sm text-slate-500">{description}</p>}
    </div>
  );
}

function PlaceholderCard({ icon, title, description }) {
  return (
    <Card>
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          {icon}
        </span>
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <p className="mt-1 max-w-xs text-xs text-slate-500">{description}</p>
      </div>
    </Card>
  );
}

export default function ProfessionalDashboardPage() {
  const { user } = useAuth();
  const linkedId = user ? user.linkedId || user.firmId : undefined;
  const dashboard = useDashboard(ROLES.PROFESSIONAL, linkedId);

  const stats = dashboard.stats || {};
  const consultations = dashboard.consultations || [];
  const cases = dashboard.cases || [];
  const reviews = dashboard.reviews || [];

  const professional =
    professionals.find((p) => p.id === linkedId) || professionals[0];

  const upcoming = consultations.filter(
    (c) => c.callStatus === 'scheduled' || c.callStatus === 'ongoing'
  );
  const ended = consultations.filter((c) => c.callStatus === 'ended');

  const clientIds = Array.from(new Set(cases.map((c) => c.clientId)));
  const myClients = clients.filter((c) => clientIds.includes(c.id));

  const caseFiles = cases.flatMap((c) => c.files || []);

  // Profile completion estimate.
  const fields = [
    professional.bio,
    professional.specialization,
    professional.registrationNumber,
    professional.languages && professional.languages.length,
    professional.perMinuteRate,
    professional.availabilitySlots && professional.availabilitySlots.length,
  ];
  const filled = fields.filter(Boolean).length;
  const completion = Math.round((filled / fields.length) * 100);

  return (
    <DashboardLayout
      role={ROLES.PROFESSIONAL}
      title="Professional dashboard"
      subtitle={`Welcome back${user && user.name ? `, ${user.name}` : ''}`}
    >
      <div className="space-y-8">
        {/* Profile completion */}
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Profile completion
              </h2>
              <p className="text-sm text-slate-500">
                A complete profile ranks higher in search results.
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
        <AvailabilityManager professional={professional} />

        {/* Today's & upcoming consultations */}
        <section>
          <SectionTitle
            title="Upcoming consultations"
            description="Scheduled and live sessions with your clients."
          />
          <ConsultationTable
            consultations={upcoming}
            emptyTitle="No upcoming consultations"
            emptyDescription="New bookings from clients will show up here."
          />
        </section>

        {/* Earnings */}
        <section>
          <SectionTitle
            title="Earnings"
            description="Your performance at a glance."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              label="Total earnings"
              value={formatCurrency(stats.totalEarnings || 0)}
              icon={<Wallet size={20} />}
              variant="green"
              hint="From completed bookings"
            />
            <StatsCard
              label="Completed consultations"
              value={stats.completedConsultations || 0}
              icon={<CheckCircle2 size={20} />}
              variant="blue"
            />
            <StatsCard
              label="Pending bookings"
              value={stats.pendingBookings || 0}
              icon={<CalendarClock size={20} />}
              variant="amber"
            />
            <StatsCard
              label="Average rating"
              value={(stats.averageRating || 0).toFixed(1)}
              icon={<Star size={20} />}
              variant="amber"
              hint={`${stats.reviewsCount || 0} reviews`}
            />
          </div>
        </section>

        {/* Clients */}
        <section>
          <SectionTitle
            title="Client list"
            description="Clients you are currently advising."
          />
          <ClientTable clients={myClients} />
        </section>

        {/* Cases */}
        <section>
          <SectionTitle
            title="Case list"
            description="Matters assigned to you across clients."
          />
          <CaseTable cases={cases} />
        </section>

        {/* Past consultations */}
        <section>
          <SectionTitle
            title="Consultation history"
            description="Completed sessions and their details."
          />
          <ConsultationTable
            consultations={ended}
            emptyTitle="No consultation history"
            emptyDescription="Completed consultations will appear here."
          />
        </section>

        {/* Documents */}
        <section>
          <SectionTitle
            title="Shared documents"
            description="Files exchanged with your clients."
          />
          <FileManager files={caseFiles} />
        </section>

        {/* Recordings & transcripts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <SectionTitle title="Call recordings" />
            <PlaceholderCard
              icon={<Video size={22} />}
              title="Recordings"
              description="Consultation call recordings will be available here once enabled."
            />
          </div>
          <div>
            <SectionTitle title="Transcripts" />
            <PlaceholderCard
              icon={<FileText size={22} />}
              title="Transcripts"
              description="Automatic transcripts of your consultations will appear here."
            />
          </div>
        </div>

        {/* Reviews */}
        <section>
          <SectionTitle
            title="Reviews received"
            description="What your clients say about working with you."
          />
          <ReviewManager reviews={reviews} />
        </section>
      </div>
    </DashboardLayout>
  );
}
