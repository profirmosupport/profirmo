'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { UserX, FileText, AlertCircle } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import EmptyState from '@/components/common/EmptyState';
import ProfessionalProfileHeader from '@/components/professionals/ProfessionalProfileHeader';
import ProfessionalServices from '@/components/professionals/ProfessionalServices';
import ProfessionalReviews from '@/components/professionals/ProfessionalReviews';
import ProfessionalCard from '@/components/professionals/ProfessionalCard';
import { useLanguage } from '@/components/LanguageProvider';
import professionalService from '@/services/professionalService';

/** Render a section with a labelled list of strings. */
function ChipSection({ icon, title, items }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
          >
            {typeof item === 'string'
              ? item
              : item.name || item.title || item.label}
          </span>
        ))}
      </div>
    </Card>
  );
}

export default function ProfessionalProfilePage() {
  const { t } = useLanguage();
  const { id } = useParams();

  const [professional, setProfessional] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError(null);
    setProfessional(null);
    (async () => {
      try {
        const data = await professionalService.getById(id);
        if (!active) return;
        if (!data || !data.id) {
          setProfessional(null);
        } else {
          setProfessional(data);
          // Fetch a few similar professionals of the same type.
          if (data.professionalType) {
            try {
              const res = await professionalService.getAll({
                professionalType: data.professionalType,
                limit: 4,
              });
              if (active) {
                const list = Array.isArray(res && res.data) ? res.data : [];
                setSimilar(list.filter((p) => p.id !== data.id).slice(0, 3));
              }
            } catch {
              if (active) setSimilar([]);
            }
          }
        }
      } catch (err) {
        if (active) {
          // A 404 is "not found"; anything else is a real error.
          if (err && err.status === 404) {
            setProfessional(null);
          } else {
            setError(err.message || 'Failed to load this professional.');
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

  // Re-fetch just the professional (e.g. after a new review is posted) so the
  // header rating / review count stay in sync without a full page reload.
  const refreshProfessional = useCallback(async () => {
    if (!id) return;
    try {
      const data = await professionalService.getById(id);
      if (data && data.id) setProfessional(data);
    } catch {
      /* keep the current professional on a refresh failure */
    }
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
                <Button href="/professionals" variant="primary">
                  {t('profDetail.browseAll')}
                </Button>
              }
            />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!professional) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <EmptyState
              icon={<UserX size={24} />}
              title={t('profDetail.notFoundTitle')}
              description={t('profDetail.notFoundDesc')}
              action={
                <Button href="/professionals" variant="primary">
                  {t('profDetail.browseAll')}
                </Button>
              }
            />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const aboutText = professional.about || professional.bio;
  const { education, certifications, achievements, lawyer } = professional;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          <ProfessionalProfileHeader professional={professional} />

          {aboutText && (
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  {t('profDetail.about')}
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                {aboutText}
              </p>
            </Card>
          )}

          <ProfessionalServices professional={professional} />

          <ChipSection
            icon={<FileText size={18} className="text-blue-600" />}
            title="Education"
            items={education}
          />
          <ChipSection
            icon={<FileText size={18} className="text-blue-600" />}
            title="Certifications"
            items={certifications}
          />
          <ChipSection
            icon={<FileText size={18} className="text-blue-600" />}
            title="Achievements"
            items={achievements}
          />

          {/* Lawyer / tax specifics, if present on the detail payload. */}
          {lawyer && (
            <Card>
              <h2 className="mb-3 text-base font-semibold text-slate-900">
                Legal practice details
              </h2>
              <dl className="grid gap-3 sm:grid-cols-2">
                {Object.entries(lawyer)
                  .filter(([, v]) => v !== null && v !== undefined && v !== '')
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) =>
                          c.toUpperCase()
                        )}
                      </dt>
                      <dd className="text-sm text-slate-700">
                        {Array.isArray(value) ? value.join(', ') : String(value)}
                      </dd>
                    </div>
                  ))}
              </dl>
            </Card>
          )}
          {/* Tax practice details section was removed — the identifiers
              we surface to clients (consultation fee, sub-categories,
              languages, etc.) already render in the header / about cards. */}

          <ProfessionalReviews
            professionalId={professional.id}
            onReviewChange={refreshProfessional}
          />

          {similar.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-900">
                {t('profDetail.similar')}
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
