import { Search, GitCompare, CalendarCheck, Video } from 'lucide-react';

const STEPS = [
  {
    icon: Search,
    title: 'Search professionals',
    description:
      'Browse verified advocates, lawyers and tax consultants by category, city and specialization.',
  },
  {
    icon: GitCompare,
    title: 'Compare & choose',
    description:
      'Review ratings, experience, languages and per-minute rates to pick the right expert.',
  },
  {
    icon: CalendarCheck,
    title: 'Book & pay securely',
    description:
      'Book an instant or scheduled consultation with transparent, pay-per-minute pricing.',
  },
  {
    icon: Video,
    title: 'Consult online',
    description:
      'Connect over a secure video call, share documents and get the advice you need.',
  },
];

/**
 * HowItWorksSection — 4 numbered steps explaining the platform flow.
 */
export default function HowItWorksSection() {
  return (
    <section className="bg-slate-50 py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            How Profirmo works
          </h2>
          <p className="mt-3 text-base text-slate-600">
            From search to consultation in four simple steps.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="relative rounded-xl border border-slate-200 bg-white p-6"
              >
                <span className="absolute right-5 top-5 text-4xl font-bold text-slate-100">
                  {index + 1}
                </span>
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <Icon size={22} />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-800">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
