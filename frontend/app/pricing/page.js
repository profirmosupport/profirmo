import { Check, Clock, Users, Briefcase, Building2, ArrowRight } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';

export const metadata = {
  title: 'Pricing — Profirmo',
  description:
    'Profirmo uses a simple pay-per-minute model — no subscriptions, no hidden fees.',
};

const PLANS = [
  {
    icon: Users,
    badge: 'For clients',
    badgeVariant: 'blue',
    title: 'Pay per minute',
    price: 'From ₹30',
    unit: '/min',
    description: 'Only pay for the consultation time you actually use.',
    features: [
      'No subscription or sign-up fee',
      'Transparent per-minute rates on every profile',
      'See an estimated cost before you book',
      'Instant and scheduled consultations',
      'Secure online payments',
    ],
    cta: { label: 'Find a professional', href: '/professionals' },
    highlight: true,
  },
  {
    icon: Briefcase,
    badge: 'For professionals',
    badgeVariant: 'green',
    title: 'Independent professionals',
    price: 'Free',
    unit: ' to join',
    description: 'List your practice and earn from online consultations.',
    features: [
      'Free verified professional profile',
      'Set your own per-minute rate',
      'Publish your own availability slots',
      'A small platform fee per consultation',
      'Automated, reliable payouts',
    ],
    cta: { label: 'Join as a professional', href: '/auth/register-professional' },
    highlight: false,
  },
  {
    icon: Building2,
    badge: 'For firms',
    badgeVariant: 'green',
    title: 'Legal & tax firms',
    price: 'Free',
    unit: ' to join',
    description: 'Bring your whole team onto Profirmo under one firm profile.',
    features: [
      'Free verified firm profile',
      'Add and manage multiple professionals',
      'Unified firm dashboard and reporting',
      'A small platform fee per consultation',
      'Consolidated billing and payouts',
    ],
    cta: { label: 'Register your firm', href: '/auth/register-firm' },
    highlight: false,
  },
];

const FAQS = [
  {
    q: 'How is the cost of a consultation calculated?',
    a: 'Each professional sets a per-minute rate shown on their profile. You are billed for the actual minutes of your consultation, so a 20-minute call at ₹45/min costs ₹900.',
  },
  {
    q: 'Are there any subscription fees?',
    a: 'No. Profirmo is completely pay-as-you-go for clients. You only pay when you book a consultation — there are no monthly charges or hidden fees.',
  },
  {
    q: 'How do professionals and firms get paid?',
    a: 'Joining Profirmo is free for professionals and firms. We charge a small platform fee per completed consultation, and the rest is paid out to you automatically.',
  },
  {
    q: 'Can I see the price before booking?',
    a: 'Yes. Before you confirm a booking you will always see the per-minute rate and an estimated cost based on the duration you choose.',
  },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Page header */}
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Simple, transparent pricing
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
              Profirmo runs on a pay-per-minute model. No subscriptions, no
              hidden fees — you only pay for the advice you receive.
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
              Pay only for the minutes you use
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Every professional on Profirmo sets a clear per-minute rate.
              Whether your consultation lasts five minutes or fifty, you are
              billed precisely for the time spent — nothing more.
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
                    key={plan.title}
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
                      <Badge variant={plan.badgeVariant}>{plan.badge}</Badge>
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-slate-900">
                      {plan.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {plan.description}
                    </p>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-slate-900">
                        {plan.price}
                      </span>
                      <span className="text-sm text-slate-500">
                        {plan.unit}
                      </span>
                    </div>
                    <ul className="mt-5 flex-1 space-y-3">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-3"
                        >
                          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <Check size={13} />
                          </span>
                          <span className="text-sm text-slate-700">
                            {feature}
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
                        {plan.cta.label}
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
              Pricing questions
            </h2>
            <div className="mt-10 space-y-4">
              {FAQS.map((faq) => (
                <Card key={faq.q}>
                  <h3 className="text-base font-semibold text-slate-800">
                    {faq.q}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">{faq.a}</p>
                </Card>
              ))}
            </div>
            <div className="mt-10 text-center">
              <p className="text-sm text-slate-600">
                Still have questions about pricing?
              </p>
              <Button href="/contact" variant="outline" size="md" className="mt-3">
                Contact our team
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
