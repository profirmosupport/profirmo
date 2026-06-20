'use client';

import {
  ShieldCheck,
  Handshake,
  Eye,
  Sparkles,
  Users,
  Building2,
  Star,
  MapPin,
} from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import LeadGenFloater from '@/components/common/LeadGenFloater';
import Card from '@/components/common/Card';
import { useLanguage } from '@/components/LanguageProvider';

const VALUES = [
  {
    icon: ShieldCheck,
    titleKey: 'about.values.trust.title',
    descKey: 'about.values.trust.desc',
  },
  {
    icon: Eye,
    titleKey: 'about.values.transparency.title',
    descKey: 'about.values.transparency.desc',
  },
  {
    icon: Handshake,
    titleKey: 'about.values.clientFirst.title',
    descKey: 'about.values.clientFirst.desc',
  },
  {
    icon: Sparkles,
    titleKey: 'about.values.quality.title',
    descKey: 'about.values.quality.desc',
  },
];

const STATS = [
  { icon: Users, value: '500+', labelKey: 'about.stats.professionals' },
  { icon: Building2, value: '120+', labelKey: 'about.stats.firms' },
  { icon: MapPin, value: '50+', labelKey: 'about.stats.cities' },
  { icon: Star, value: '4.8', labelKey: 'about.stats.rating' },
];

export default function AboutPage() {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Page header */}
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              {t('about.hero.title')}
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
              {t('about.hero.subtitle')}
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
              <div>
                <span className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                  {t('about.mission.badge')}
                </span>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                  {t('about.mission.title')}
                </h2>
                <p className="mt-4 text-base text-slate-600">
                  {t('about.mission.p1')}
                </p>
                <p className="mt-4 text-base text-slate-600">
                  {t('about.mission.p2')}
                </p>
              </div>
              <div>
                <span className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                  {t('about.story.badge')}
                </span>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                  {t('about.story.title')}
                </h2>
                <p className="mt-4 text-base text-slate-600">
                  {t('about.story.p1')}
                </p>
                <p className="mt-4 text-base text-slate-600">
                  {t('about.story.p2')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="bg-slate-50 py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                {t('about.values.title')}
              </h2>
              <p className="mt-3 text-base text-slate-600">
                {t('about.values.subtitle')}
              </p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {VALUES.map((value) => {
                const Icon = value.icon;
                return (
                  <Card key={value.titleKey}>
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-white">
                      <Icon size={22} />
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-slate-800">
                      {t(value.titleKey)}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {t(value.descKey)}
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Stats strip */}
        <section className="bg-blue-700 py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
              {STATS.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.labelKey} className="text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-white/15 text-blue-100">
                      <Icon size={22} />
                    </span>
                    <p className="mt-3 text-3xl font-bold text-white">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-sm text-blue-100">
                      {t(stat.labelKey)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <LeadGenFloater source="about-page" />
    </div>
  );
}
