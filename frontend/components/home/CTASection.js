import { ArrowRight } from 'lucide-react';
import Button from '@/components/common/Button';

/**
 * CTASection — closing call-to-action band.
 */
export default function CTASection() {
  return (
    <section className="bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 px-6 py-14 text-center sm:px-12 lg:py-16">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(circle at 80% 0%, white 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to get expert advice?
            </h2>
            <p className="mt-4 text-base text-blue-100 sm:text-lg">
              Join thousands of clients and professionals using Profirmo for
              trusted legal and tax consultations.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                href="/professionals"
                variant="secondary"
                size="lg"
                className="w-full bg-white text-blue-700 hover:bg-blue-50 sm:w-auto"
              >
                Find a professional
                <ArrowRight size={18} />
              </Button>
              <Button
                href="/auth/register-professional"
                variant="outline"
                size="lg"
                className="w-full border-white/40 bg-transparent text-white hover:bg-white/10 sm:w-auto"
              >
                Join as a professional
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
