import { Check, Users, Briefcase } from 'lucide-react';

const CLIENT_BENEFITS = [
  'Access verified, background-checked legal and tax experts',
  'Compare ratings, experience and transparent per-minute rates',
  'Book instant or scheduled consultations that fit your day',
  'Pay only for the minutes you use — no subscriptions',
  'Manage cases, documents and consultations in one place',
];

const PROFESSIONAL_BENEFITS = [
  'Reach new clients actively searching for your expertise',
  'Set your own per-minute rate and availability slots',
  'Run secure online consultations with built-in scheduling',
  'Build a public profile with verified reviews and ratings',
  'Get paid reliably with automated, transparent billing',
];

function BenefitColumn({ icon: Icon, accent, title, subtitle, benefits }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-lg ${accent}`}
        >
          <Icon size={22} />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      <ul className="mt-6 space-y-3">
        {benefits.map((benefit) => (
          <li key={benefit} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check size={13} />
            </span>
            <span className="text-sm text-slate-700">{benefit}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * BenefitsSection — two-column value proposition for clients and professionals.
 */
export default function BenefitsSection() {
  return (
    <section className="bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Built for both sides of the table
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Profirmo makes professional consultations simple — whether you need
            advice or provide it.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <BenefitColumn
            icon={Users}
            accent="bg-blue-50 text-blue-600"
            title="For clients"
            subtitle="Get expert advice on your terms"
            benefits={CLIENT_BENEFITS}
          />
          <BenefitColumn
            icon={Briefcase}
            accent="bg-emerald-50 text-emerald-600"
            title="For professionals & firms"
            subtitle="Grow your practice online"
            benefits={PROFESSIONAL_BENEFITS}
          />
        </div>
      </div>
    </section>
  );
}
