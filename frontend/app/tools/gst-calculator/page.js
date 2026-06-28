import GSTCalculatorClient from './GSTCalculatorClient';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import LeadGenFloater from '@/components/common/LeadGenFloater';
import JsonLd, { breadcrumb, webPage, SITE_URL } from '@/components/seo/JsonLd';

export const metadata = {
  title: 'Free GST Calculator (2026) — CGST + SGST + IGST in One Click · Pro Firmo',
  description:
    'Free GST calculator for Indian businesses. Add or remove GST at 0.25%, 3%, 5%, 12%, 18%, 28%. Split CGST + SGST for intra-state, IGST for inter-state. No signup. Works offline.',
  keywords:
    'GST calculator India, online GST calculator, CGST SGST IGST, reverse GST calculator, GST rate calculator 2026',
  alternates: { canonical: '/tools/gst-calculator' },
  openGraph: {
    title: 'Free GST Calculator (2026) · Pro Firmo',
    description:
      'Calculate CGST + SGST + IGST instantly. Forward and reverse modes. Free, no signup.',
    url: 'https://profirmo.com/tools/gst-calculator',
    type: 'website',
  },
};

const HOWTO_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to calculate GST in India',
  description:
    'Calculate forward GST (add to a base amount) and reverse GST (extract from a tax-inclusive amount) at standard Indian GST rates.',
  step: [
    {
      '@type': 'HowToStep',
      name: 'Enter the amount',
      text: 'Type the base price (forward mode) or the GST-inclusive total (reverse mode).',
    },
    {
      '@type': 'HowToStep',
      name: 'Pick a GST rate',
      text: 'Select the applicable rate: 0.25%, 3%, 5%, 12%, 18%, or 28%.',
    },
    {
      '@type': 'HowToStep',
      name: 'Choose supply type',
      text: 'Intra-state splits the tax into CGST + SGST. Inter-state shows IGST. The math is the same total.',
    },
    {
      '@type': 'HowToStep',
      name: 'Read the result',
      text: 'The calculator shows base amount, tax, and final amount with CGST + SGST or IGST broken out.',
    },
  ],
};

const EXTRA_JSONLD = [
  webPage({
    url: '/tools/gst-calculator',
    name: 'Free GST Calculator (2026) — CGST + SGST + IGST in One Click · Pro Firmo',
    description:
      'Free GST calculator for Indian businesses. Add or remove GST at 0.25%, 3%, 5%, 12%, 18%, 28%. Split CGST + SGST for intra-state, IGST for inter-state.',
    type: 'WebPage',
  }),
  breadcrumb([
    { name: 'Home', url: '/' },
    { name: 'Tools', url: '/tools/gst-calculator' },
    { name: 'GST Calculator', url: '/tools/gst-calculator' },
  ]),
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${SITE_URL}/tools/gst-calculator#app`,
    name: 'GST Calculator',
    url: `${SITE_URL}/tools/gst-calculator`,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
    publisher: { '@id': `${SITE_URL}#organization` },
  },
];

export default function GSTCalculatorPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOWTO_JSONLD) }}
      />
      <JsonLd data={EXTRA_JSONLD} />
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
          <div className="pointer-events-none absolute -right-32 top-0 h-72 w-72 rounded-full bg-amber-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -left-32 bottom-0 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="relative mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-200">
              Free tool
            </span>
            <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
              GST Calculator (India, 2026)
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
              Calculate CGST + SGST + IGST at standard Indian rates. Forward
              (add GST to a base price) or reverse (extract GST from a
              tax-inclusive total). Free, no signup, all client-side.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <GSTCalculatorClient />
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-14 sm:px-6 lg:px-8">
          <h2 className="text-base font-semibold uppercase tracking-widest text-slate-700">
            How GST works in India
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">
            <p>
              India runs a destination-based dual-GST model. Intra-state
              supplies attract Central GST (CGST) and State GST (SGST) in
              equal halves of the applicable rate. Inter-state supplies
              attract Integrated GST (IGST) at the full rate. The total tax
              on the invoice is the same either way — only the credit flow
              differs.
            </p>
            <p>
              Standard rates as of 2026: 0%, 0.25% (rough diamonds, etc.),
              3% (gold and certain precious items), 5%, 12%, 18%, 28%. Most
              services land at 18%; restaurants generally at 5% without ITC;
              most manufactured goods at 12% or 18%; luxury / sin goods at
              28% with cess on top in some cases.
            </p>
            <p>
              To switch between intra-state and inter-state in the
              calculator, toggle the supply type. The base, tax total, and
              final amount stay the same; the breakdown changes from CGST +
              SGST to IGST.
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <LeadGenFloater source="tool-gst-calculator" />
    </div>
  );
}
