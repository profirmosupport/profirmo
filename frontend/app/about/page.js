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
import Card from '@/components/common/Card';

export const metadata = {
  title: 'About — Pro Firmo',
  description:
    'Learn about Pro Firmo, the platform connecting clients with verified legal and tax professionals.',
};

const VALUES = [
  {
    icon: ShieldCheck,
    title: 'Trust & verification',
    description:
      'Every professional and firm on Pro Firmo is verified before they can offer consultations.',
  },
  {
    icon: Eye,
    title: 'Transparency',
    description:
      'Clear per-minute rates, honest reviews and no hidden fees — you always know what you pay for.',
  },
  {
    icon: Handshake,
    title: 'Client first',
    description:
      'We design every feature around making expert advice accessible, simple and stress-free.',
  },
  {
    icon: Sparkles,
    title: 'Quality of advice',
    description:
      'We champion experienced practitioners and surface the experts our clients rate the highest.',
  },
];

const STATS = [
  { icon: Users, value: '500+', label: 'Verified professionals' },
  { icon: Building2, value: '120+', label: 'Partner firms' },
  { icon: MapPin, value: '50+', label: 'Cities covered' },
  { icon: Star, value: '4.8', label: 'Average rating' },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Page header */}
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              About Pro Firmo
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
              We are on a mission to make trusted legal and tax advice
              accessible to everyone, everywhere.
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
              <div>
                <span className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                  Our mission
                </span>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                  Expert advice, without the friction
                </h2>
                <p className="mt-4 text-base text-slate-600">
                  Finding the right advocate or tax consultant has always been
                  hard — relying on word of mouth, unclear pricing and long
                  waits for an appointment. Pro Firmo changes that.
                </p>
                <p className="mt-4 text-base text-slate-600">
                  We bring verified professionals and firms online, so anyone
                  can compare experts, book a consultation and get qualified
                  advice in minutes — paying only for the time they use.
                </p>
              </div>
              <div>
                <span className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                  Our story
                </span>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                  Built by people who needed it
                </h2>
                <p className="mt-4 text-base text-slate-600">
                  Pro Firmo started with a simple frustration: getting reliable
                  legal and tax help should not depend on who you happen to
                  know. We saw skilled professionals struggling to reach
                  clients, and clients struggling to find them.
                </p>
                <p className="mt-4 text-base text-slate-600">
                  So we built a single, trusted platform that connects both —
                  with verified profiles, transparent pricing and secure online
                  consultations from anywhere in the country.
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
                What we stand for
              </h2>
              <p className="mt-3 text-base text-slate-600">
                The principles that guide every decision we make.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {VALUES.map((value) => {
                const Icon = value.icon;
                return (
                  <Card key={value.title}>
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-white">
                      <Icon size={22} />
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-slate-800">
                      {value.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {value.description}
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
                  <div key={stat.label} className="text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-white/15 text-blue-100">
                      <Icon size={22} />
                    </span>
                    <p className="mt-3 text-3xl font-bold text-white">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-sm text-blue-100">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
