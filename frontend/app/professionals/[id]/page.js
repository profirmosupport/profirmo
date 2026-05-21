'use client';

import { useParams } from 'next/navigation';
import { UserX, FileText } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import EmptyState from '@/components/common/EmptyState';
import ProfessionalProfileHeader from '@/components/professionals/ProfessionalProfileHeader';
import ProfessionalServices from '@/components/professionals/ProfessionalServices';
import ProfessionalAvailability from '@/components/professionals/ProfessionalAvailability';
import ProfessionalReviews from '@/components/professionals/ProfessionalReviews';
import ProfessionalCard from '@/components/professionals/ProfessionalCard';
import { getProfessionalById, professionals } from '@/data/mockData';

export default function ProfessionalProfilePage() {
  const { id } = useParams();
  const professional = getProfessionalById(id);

  if (!professional) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <EmptyState
              icon={<UserX size={24} />}
              title="Professional not found"
              description="The professional you are looking for does not exist or may have been removed."
              action={
                <Button href="/professionals" variant="primary">
                  Browse all professionals
                </Button>
              }
            />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const similar = professionals
    .filter(
      (p) =>
        p.id !== professional.id &&
        p.professionType === professional.professionType
    )
    .slice(0, 3);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          <ProfessionalProfileHeader professional={professional} />

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <FileText size={18} className="text-blue-600" />
              <h2 className="text-base font-semibold text-slate-900">About</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              {professional.bio}
            </p>
          </Card>

          <ProfessionalServices professional={professional} />
          <ProfessionalAvailability professional={professional} />
          <ProfessionalReviews professionalId={professional.id} />

          {similar.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-900">
                Similar professionals
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {similar.map((pro) => (
                  <ProfessionalCard key={pro.id} professional={pro} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
