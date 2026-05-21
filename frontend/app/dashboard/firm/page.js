'use client';

import { useState } from 'react';
import {
  Users,
  UserCheck,
  Briefcase,
  Video,
  Wallet,
  Plus,
  UserPlus,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import StatsCard from '@/components/dashboard/StatsCard';
import CaseTable from '@/components/dashboard/CaseTable';
import ConsultationTable from '@/components/dashboard/ConsultationTable';
import FileManager from '@/components/dashboard/FileManager';
import ReviewManager from '@/components/dashboard/ReviewManager';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Modal from '@/components/common/Modal';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import RatingStars from '@/components/common/RatingStars';
import EmptyState from '@/components/common/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { useDashboard } from '@/hooks/useDashboard';
import { ROLES, PROFESSION_TYPES, SPECIALIZATIONS } from '@/utils/constants';
import { formatCurrency, formatRate, getInitials } from '@/utils/formatters';
import { consultations as allConsultations, reviews } from '@/data/mockData';

const professionOptions = PROFESSION_TYPES.map((p) => ({ value: p, label: p }));
const specializationOptions = SPECIALIZATIONS.map((s) => ({
  value: s,
  label: s,
}));

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

export default function FirmDashboardPage() {
  const { user } = useAuth();
  const linkedId = user ? user.firmId || user.linkedId : undefined;
  const dashboard = useDashboard(ROLES.FIRM_ADMIN, linkedId);

  const stats = dashboard.stats || {};
  const firm = dashboard.firm || {};
  const firmProfessionals = dashboard.professionals || [];
  const cases = dashboard.cases || [];

  const proIds = firmProfessionals.map((p) => p.id);
  const firmConsultations = allConsultations.filter((c) =>
    proIds.includes(c.professionalId)
  );
  const firmReviews = reviews.filter((r) => proIds.includes(r.professionalId));
  const clientCount = new Set(cases.map((c) => c.clientId)).size;
  const caseFiles = cases.flatMap((c) => c.files || []);

  const [modalOpen, setModalOpen] = useState(false);
  const [newPro, setNewPro] = useState({
    name: '',
    email: '',
    professionType: '',
    specialization: '',
  });

  function handleNewProChange(e) {
    const { name, value } = e.target;
    setNewPro((p) => ({ ...p, [name]: value }));
  }

  function handleAddPro(e) {
    e.preventDefault();
    setModalOpen(false);
    setNewPro({
      name: '',
      email: '',
      professionType: '',
      specialization: '',
    });
  }

  return (
    <DashboardLayout
      role={ROLES.FIRM_ADMIN}
      title={firm.name ? `${firm.name} — Firm console` : 'Firm console'}
      subtitle="Manage your team, clients and consultations"
    >
      <div className="space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatsCard
            label="Professionals"
            value={stats.totalProfessionals || 0}
            icon={<Users size={20} />}
            variant="blue"
          />
          <StatsCard
            label="Clients"
            value={clientCount}
            icon={<UserCheck size={20} />}
            variant="green"
          />
          <StatsCard
            label="Total cases"
            value={stats.totalCases || 0}
            icon={<Briefcase size={20} />}
            variant="amber"
            hint={`${stats.activeCases || 0} active`}
          />
          <StatsCard
            label="Consultations"
            value={firmConsultations.length}
            icon={<Video size={20} />}
            variant="slate"
          />
          <StatsCard
            label="Revenue"
            value={formatCurrency(stats.revenue || 0)}
            icon={<Wallet size={20} />}
            variant="green"
            hint="Completed bookings"
          />
        </div>

        {/* Team management */}
        <section>
          <SectionTitle
            title="Team management"
            description="Lawyers and consultants in your firm."
            action={
              <Button size="sm" onClick={() => setModalOpen(true)}>
                <Plus size={15} />
                Add lawyer / consultant
              </Button>
            }
          />
          {firmProfessionals.length === 0 ? (
            <EmptyState
              icon={<Users size={24} />}
              title="No team members yet"
              description="Add your first professional to get started."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {firmProfessionals.map((pro) => (
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
                        {pro.professionType}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <RatingStars rating={pro.rating} size="sm" />
                        <Badge
                          variant={pro.availableNow ? 'green' : 'gray'}
                        >
                          {pro.availableNow ? 'Available' : 'Offline'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <span>{pro.experience} yrs experience</span>
                    <span className="font-medium text-slate-700">
                      {formatRate(pro.perMinuteRate)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Assign clients placeholder */}
        <section>
          <SectionTitle title="Assign clients" />
          <Card>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <UserPlus size={22} />
              </span>
              <p className="text-sm font-medium text-slate-700">
                Client assignment
              </p>
              <p className="mt-1 max-w-md text-xs text-slate-500">
                Route incoming clients to the right professional in your firm.
                This workflow will be available here soon.
              </p>
              <Button variant="ghost" size="sm" className="mt-3" disabled>
                Configure routing
              </Button>
            </div>
          </Card>
        </section>

        {/* Cases */}
        <section>
          <SectionTitle
            title="All cases"
            description="Every matter handled across your firm."
          />
          <CaseTable cases={cases} />
        </section>

        {/* Consultations */}
        <section>
          <SectionTitle
            title="Consultation history"
            description="All sessions conducted by your professionals."
          />
          <ConsultationTable consultations={firmConsultations} />
        </section>

        {/* Files */}
        <section>
          <SectionTitle
            title="All files"
            description="Documents shared across firm cases."
          />
          <FileManager files={caseFiles} />
        </section>

        {/* Reviews */}
        <section>
          <SectionTitle
            title="Ratings & reviews"
            description="Client feedback for your firm's professionals."
          />
          <ReviewManager reviews={firmReviews} />
        </section>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add lawyer / consultant"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button size="sm" type="submit" form="add-pro-form">
              Add to team
            </Button>
          </>
        }
      >
        <form id="add-pro-form" onSubmit={handleAddPro} className="space-y-4">
          <Input
            label="Full name"
            name="name"
            value={newPro.name}
            onChange={handleNewProChange}
            placeholder="Professional's full name"
          />
          <Input
            label="Email address"
            name="email"
            type="email"
            value={newPro.email}
            onChange={handleNewProChange}
            placeholder="name@firm.com"
          />
          <Select
            label="Profession type"
            name="professionType"
            value={newPro.professionType}
            onChange={handleNewProChange}
            options={professionOptions}
            placeholder="Select profession"
          />
          <Select
            label="Specialization"
            name="specialization"
            value={newPro.specialization}
            onChange={handleNewProChange}
            options={specializationOptions}
            placeholder="Select specialization"
          />
        </form>
      </Modal>
    </DashboardLayout>
  );
}
