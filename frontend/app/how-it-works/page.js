'use client';

import {
  Search,
  GitCompare,
  CalendarCheck,
  Video,
  UserPlus,
  ClipboardCheck,
  CalendarClock,
  Wallet,
  ArrowRight,
} from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import LeadGenFloater from '@/components/common/LeadGenFloater';
import Button from '@/components/common/Button';
import { useLanguage } from '@/components/LanguageProvider';

const CLIENT_STEPS = [
  {
    icon: Search,
    titleKey: 'howItWorksPage.client.search.title',
    descKey: 'howItWorksPage.client.search.desc',
  },
  {
    icon: GitCompare,
    titleKey: 'howItWorksPage.client.compare.title',
    descKey: 'howItWorksPage.client.compare.desc',
  },
  {
    icon: CalendarCheck,
    titleKey: 'howItWorksPage.client.book.title',
    descKey: 'howItWorksPage.client.book.desc',
  },
  {
    icon: Video,
    titleKey: 'howItWorksPage.client.consult.title',
    descKey: 'howItWorksPage.client.consult.desc',
  },
];

const PROFESSIONAL_STEPS = [
  {
    icon: UserPlus,
    titleKey: 'howItWorksPage.pro.profile.title',
    descKey: 'howItWorksPage.pro.profile.desc',
  },
  {
    icon: ClipboardCheck,
    titleKey: 'howItWorksPage.pro.verify.title',
    descKey: 'howItWorksPage.pro.verify.desc',
  },
  {
    icon: CalendarClock,
    titleKey: 'howItWorksPage.pro.rates.title',
    descKey: 'howItWorksPage.pro.rates.desc',
  },
  {
    icon: Wallet,
    titleKey: 'howItWorksPage.pro.paid.title',
    descKey: 'howItWorksPage.pro.paid.desc',
  },
];

function Track({ badge, title, description, steps, accent, t }) {
  return (
    <div>
      <span
        className={`text-sm font-semibold uppercase tracking-wide ${accent}`}
      >
        {badge}
      </span>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-base text-slate-600">{description}</p>
      <div className="mt-8 space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div
              key={step.titleKey}
              className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-col items-center">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <Icon size={20} />
                </span>
                {index < steps.length - 1 && (
                  <span className="mt-2 w-px flex-1 bg-slate-200" />
                )}
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">
                    {t('howItWorksPage.step', { n: index + 1 })}
                  </span>
                </div>
                <h3 className="mt-0.5 text-base font-semibold text-slate-800">
                  {t(step.titleKey)}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {t(step.descKey)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HowItWorksPage() {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Page header */}
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              {t('howItWorksPage.hero.title')}
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
              {t('howItWorksPage.hero.subtitle')}
            </p>
          </div>
        </section>

        {/* Tracks */}
        <section className="bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
              <Track
                badge={t('howItWorksPage.clients.badge')}
                title={t('howItWorksPage.clients.title')}
                description={t('howItWorksPage.clients.desc')}
                steps={CLIENT_STEPS}
                accent="text-blue-600"
                t={t}
              />
              <Track
                badge={t('howItWorksPage.pros.badge')}
                title={t('howItWorksPage.pros.title')}
                description={t('howItWorksPage.pros.desc')}
                steps={PROFESSIONAL_STEPS}
                accent="text-emerald-600"
                t={t}
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-slate-50 py-16">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t('howItWorksPage.cta.title')}
            </h2>
            <p className="mt-3 text-base text-slate-600">
              {t('howItWorksPage.cta.desc')}
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button href="/professionals" size="lg">
                {t('howItWorksPage.cta.findPro')}
                <ArrowRight size={18} />
              </Button>
              <Button
                href="/auth/register-professional"
                variant="outline"
                size="lg"
              >
                {t('howItWorksPage.cta.joinPro')}
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <LeadGenFloater source="how-it-works" />
    </div>
  );
}
