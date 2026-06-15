'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FileText, AlertCircle } from 'lucide-react';
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
import { JsonLd, buildProfessionalJsonLd } from '@/utils/seo';

// Format a value from the `lawyer` detail object for display.
// Plain strings/numbers go straight through; arrays get comma-joined; empty
// or object-shaped values render as "Information not provided" — without
// this, `availability: {}` (and similar) would stringify to `[object Object]`.
function formatLawyerValue(value) {
  if (value === null || value === undefined || value === '') {
    return 'Information not provided';
  }
  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : 'Information not provided';
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(
      ([, v]) => v !== null && v !== undefined && v !== ''
    );
    if (entries.length === 0) return 'Information not provided';
    return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
  }
  return String(value);
}

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
  const router = useRouter();

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

  // Not found OR suspended (backend returns 404 for both). The user's spec
  // is to send the visitor to the home page — there's nothing actionable for
  // them on this URL. `replace` keeps the broken URL out of browser history.
  if (!professional) {
    if (typeof window !== 'undefined') router.replace('/');
    return null;
  }

  const aboutText = professional.about || professional.bio;
  const { education, certifications, achievements, lawyer } = professional;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Structured data — gives Googlebot / Bingbot / ChatGPT / Claude /
          Perplexity a machine-readable view of the professional so they can
          cite the profile in answers (rating, fee, specialties, location). */}
      <JsonLd
        id="professional-jsonld"
        data={buildProfessionalJsonLd(professional)}
      />
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          <ProfessionalProfileHeader professional={professional} />

          {/* Lawyer / tax specifics — shown above About so the credentials
              (bar registration, jurisdiction, practice areas) lead the
              profile narrative. */}
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
                        {formatLawyerValue(value)}
                      </dd>
                    </div>
                  ))}
              </dl>
            </Card>
          )}

          {(aboutText ||
            (Array.isArray(professional.subCategoryTree) &&
              professional.subCategoryTree.length > 0)) && (
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  {t('profDetail.about')}
                </h2>
              </div>
              {aboutText && (
                <p className="text-sm leading-relaxed text-slate-600">
                  {aboutText}
                </p>
              )}
              {Array.isArray(professional.subCategoryTree) &&
                professional.subCategoryTree.length > 0 && (
                  <div className="mt-5 space-y-5 border-t border-slate-100 pt-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Skills &amp; specialisations
                    </p>
                    <ul className="space-y-5">
                      {professional.subCategoryTree.map((root) => (
                        <li key={root.id}>
                          {/* Tier-1: sub-category */}
                          <p className="text-sm font-bold text-slate-900">
                            {root.name}
                          </p>
                          {Array.isArray(root.children) &&
                          root.children.length > 0 ? (
                            <ul className="mt-2 ml-3 space-y-3 border-l border-slate-200 pl-4">
                              {root.children.map((sub) => (
                                <li key={sub.id}>
                                  {/* Tier-2: sub-sub-category */}
                                  <p className="text-sm font-semibold text-slate-700">
                                    {sub.name}
                                  </p>
                                  {/* Tier-3: tags */}
                                  {Array.isArray(sub.tags) &&
                                    sub.tags.length > 0 && (
                                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                                        {sub.tags.map((tag) => (
                                          <span
                                            key={tag.id}
                                            className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200"
                                          >
                                            {tag.name}
                                          </span>
                                        ))}
                                        {sub.tagOverflow > 0 && (
                                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                                            +{sub.tagOverflow} more
                                          </span>
                                        )}
                                      </div>
                                    )}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
