'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Building2, AlertCircle } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import Button from '@/components/common/Button';
import EmptyState from '@/components/common/EmptyState';
import FirmProfileHeader from '@/components/firms/FirmProfileHeader';
import FirmAboutDetails from '@/components/firms/FirmAboutDetails';
import FirmServices from '@/components/firms/FirmServices';
import FirmProfessionalsList from '@/components/firms/FirmProfessionalsList';
import FirmReviews from '@/components/firms/FirmReviews';
import { useLanguage } from '@/components/LanguageProvider';
import firmService from '@/services/firmService';
import { JsonLd, buildFirmJsonLd } from '@/utils/seo';

export default function FirmProfilePage() {
  const { t } = useLanguage();
  const { id } = useParams();

  const [firm, setFirm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError(null);
    setFirm(null);
    (async () => {
      try {
        const data = await firmService.getById(id);
        if (!active) return;
        if (!data || !data.id) {
          setFirm(null);
        } else {
          setFirm(data);
        }
      } catch (err) {
        if (active) {
          if (err && err.status === 404) {
            setFirm(null);
          } else {
            setError(err.message || 'Failed to load this firm.');
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 bg-slate-50">
          <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
            <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
            <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
            <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <EmptyState
              icon={<AlertCircle size={24} />}
              title="Something went wrong"
              description={error}
              action={
                <Button href="/firms" variant="primary">
                  {t('firmDetail.browseAll')}
                </Button>
              }
            />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!firm) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <EmptyState
              icon={<Building2 size={24} />}
              title={t('firmDetail.notFoundTitle')}
              description={t('firmDetail.notFoundDesc')}
              action={
                <Button href="/firms" variant="primary">
                  {t('firmDetail.browseAll')}
                </Button>
              }
            />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Structured data — gives Googlebot / Bingbot / ChatGPT / Claude /
          Perplexity a machine-readable view of the firm (LegalService /
          ProfessionalService) so it can be cited in AI answers. */}
      <JsonLd id="firm-jsonld" data={buildFirmJsonLd(firm)} />
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          <FirmProfileHeader firm={firm} />
          <FirmAboutDetails firm={firm} />
          <FirmServices firm={firm} />
          <FirmProfessionalsList firm={firm} />
          <FirmReviews firmId={firm.id} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
