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
import Button from '@/components/common/Button';

export const metadata = {
  title: 'How it works — Pro Firmo',
  description:
    'Understand how Pro Firmo connects clients with verified legal and tax professionals.',
};

const CLIENT_STEPS = [
  {
    icon: Search,
    title: 'Search professionals',
    description:
      'Browse verified advocates, lawyers and tax consultants. Filter by category, city, language and rate to narrow down your options.',
  },
  {
    icon: GitCompare,
    title: 'Compare & choose',
    description:
      'Review detailed profiles — experience, specialization, client reviews and per-minute rates — and shortlist the expert who fits your need.',
  },
  {
    icon: CalendarCheck,
    title: 'Book & pay securely',
    description:
      'Book an instant consultation or pick a scheduled slot. You see an estimated cost upfront and pay only for the minutes you use.',
  },
  {
    icon: Video,
    title: 'Consult online',
    description:
      'Join a secure video consultation, share relevant documents, and receive clear professional advice — all from one place.',
  },
];

const PROFESSIONAL_STEPS = [
  {
    icon: UserPlus,
    title: 'Create your profile',
    description:
      'Register as an individual professional or as a firm. Add your specialization, experience, languages and services offered.',
  },
  {
    icon: ClipboardCheck,
    title: 'Get verified',
    description:
      'Our team reviews your registration and credentials. Once approved, your verified profile goes live to clients.',
  },
  {
    icon: CalendarClock,
    title: 'Set rates & availability',
    description:
      'Define your per-minute rate and publish the time slots you are available for instant or scheduled consultations.',
  },
  {
    icon: Wallet,
    title: 'Consult & get paid',
    description:
      'Connect with clients over secure video calls. Billing is automated and transparent, with reliable payouts.',
  },
];

function Track({ badge, title, description, steps, accent }) {
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
              key={step.title}
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
                    Step {index + 1}
                  </span>
                </div>
                <h3 className="mt-0.5 text-base font-semibold text-slate-800">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {step.description}
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
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Page header */}
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              How Pro Firmo works
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
              A simple, transparent process — whether you are looking for advice
              or providing it.
            </p>
          </div>
        </section>

        {/* Tracks */}
        <section className="bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
              <Track
                badge="For clients"
                title="Get expert advice in 4 steps"
                description="From your first search to a finished consultation, Pro Firmo keeps every step clear and secure."
                steps={CLIENT_STEPS}
                accent="text-blue-600"
              />
              <Track
                badge="For professionals & firms"
                title="Grow your practice online"
                description="Reach clients actively looking for your expertise and run consultations on your own terms."
                steps={PROFESSIONAL_STEPS}
                accent="text-emerald-600"
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-slate-50 py-16">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Ready to get started?
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Find the right professional today, or join Pro Firmo to grow your
              practice.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button href="/professionals" size="lg">
                Find a professional
                <ArrowRight size={18} />
              </Button>
              <Button
                href="/auth/register-professional"
                variant="outline"
                size="lg"
              >
                Join as a professional
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
