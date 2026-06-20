'use client';

import { Check, Clock, Users, Briefcase, Building2, ArrowRight } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import LeadGenFloater from '@/components/common/LeadGenFloater';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import { useLanguage } from '@/components/LanguageProvider';

const PLANS = [
  {
    icon: Users,
    badgeKey: 'pricing.plan.client.badge',
    badgeVariant: 'blue',
    titleKey: 'pricing.plan.client.title',
    priceKey: 'pricing.plan.client.price',
    unitKey: 'pricing.plan.client.unit',
    descKey: 'pricing.plan.client.desc',
    featureKeys: [
      'pricing.plan.client.f1',
      'pricing.plan.client.f2',
      'pricing.plan.client.f3',
      'pricing.plan.client.f4',
      'pricing.plan.client.f5',
    ],
    cta: { labelKey: 'pricing.plan.client.cta', href: '/professionals' },
    highlight: true,
  },
  {
    icon: Briefcase,
    badgeKey: 'pricing.plan.pro.badge',
    badgeVariant: 'green',
    titleKey: 'pricing.plan.pro.title',
    priceKey: 'pricing.plan.pro.price',
    unitKey: 'pricing.plan.pro.unit',
    descKey: 'pricing.plan.pro.desc',
    featureKeys: [
      'pricing.plan.pro.f1',
      'pricing.plan.pro.f2',
      'pricing.plan.pro.f3',
      'pricing.plan.pro.f4',
      'pricing.plan.pro.f5',
    ],
    cta: {
      labelKey: 'pricing.plan.pro.cta',
      href: '/auth/register-professional',
    },
    highlight: false,
  },
  {
    icon: Building2,
    badgeKey: 'pricing.plan.firm.badge',
    badgeVariant: 'green',
    titleKey: 'pricing.plan.firm.title',
    priceKey: 'pricing.plan.firm.price',
    unitKey: 'pricing.plan.firm.unit',
    descKey: 'pricing.plan.firm.desc',
    featureKeys: [
      'pricing.plan.firm.f1',
      'pricing.plan.firm.f2',
      'pricing.plan.firm.f3',
      'pricing.plan.firm.f4',
      'pricing.plan.firm.f5',
    ],
    cta: { labelKey: 'pricing.plan.firm.cta', href: '/signup' },
    highlight: false,
  },
];

const FAQS = [
  { qKey: 'pricing.faq.q1', aKey: 'pricing.faq.a1' },
  { qKey: 'pricing.faq.q2', aKey: 'pricing.faq.a2' },
  { qKey: 'pricing.faq.q3', aKey: 'pricing.faq.a3' },
  { qKey: 'pricing.faq.q4', aKey: 'pricing.faq.a4' },
];

export default function PricingPage() {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Page header */}
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              {t('pricing.hero.title')}
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
              {t('pricing.hero.subtitle')}
            </p>
          </div>
        </section>

        {/* Pay-per-minute explainer */}
        <section className="bg-white pt-16 lg:pt-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Clock size={26} />
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
              {t('pricing.explainer.title')}
            </h2>
            <p className="mt-3 text-base text-slate-600">
              {t('pricing.explainer.desc')}
            </p>
          </div>
        </section>

        {/* Plan cards */}
        <section className="bg-white py-12 lg:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {PLANS.map((plan) => {
                const Icon = plan.icon;
                return (
                  <Card
                    key={plan.titleKey}
                    className={`flex flex-col ${
                      plan.highlight
                        ? 'border-blue-300 ring-1 ring-blue-200'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Icon size={20} />
                      </span>
                      <Badge variant={plan.badgeVariant}>
                        {t(plan.badgeKey)}
                      </Badge>
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-slate-900">
                      {t(plan.titleKey)}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {t(plan.descKey)}
                    </p>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-slate-900">
                        {t(plan.priceKey)}
                      </span>
                      <span className="text-sm text-slate-500">
                        {t(plan.unitKey)}
                      </span>
                    </div>
                    <ul className="mt-5 flex-1 space-y-3">
                      {plan.featureKeys.map((featureKey) => (
                        <li
                          key={featureKey}
                          className="flex items-start gap-3"
                        >
                          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <Check size={13} />
                          </span>
                          <span className="text-sm text-slate-700">
                            {t(featureKey)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6">
                      <Button
                        href={plan.cta.href}
                        variant={plan.highlight ? 'primary' : 'outline'}
                        size="md"
                        className="w-full"
                      >
                        {t(plan.cta.labelKey)}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-slate-50 py-16 lg:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
              {t('pricing.faq.title')}
            </h2>
            <div className="mt-10 space-y-4">
              {FAQS.map((faq) => (
                <Card key={faq.qKey}>
                  <h3 className="text-base font-semibold text-slate-800">
                    {t(faq.qKey)}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">{t(faq.aKey)}</p>
                </Card>
              ))}
            </div>
            <div className="mt-10 text-center">
              <p className="text-sm text-slate-600">
                {t('pricing.faq.moreQuestions')}
              </p>
              <Button href="/contact" variant="outline" size="md" className="mt-3">
                {t('pricing.faq.contactCta')}
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <LeadGenFloater source="pricing-page" />
    </div>
  );
}
