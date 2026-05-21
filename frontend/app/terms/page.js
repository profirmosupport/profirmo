import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';

export const metadata = {
  title: 'Terms & Conditions — Profirmo',
  description:
    'The terms and conditions governing the use of the Profirmo platform.',
};

const SECTIONS = [
  {
    title: 'Acceptance of terms',
    body: [
      'By accessing or using Profirmo (the "Platform"), you agree to be bound by these Terms & Conditions and our Privacy Policy. If you do not agree with any part of these terms, you should not use the Platform.',
      'These terms apply to all users of the Platform, including clients seeking consultations and professionals or firms offering them.',
    ],
  },
  {
    title: 'Accounts and registration',
    body: [
      'To access certain features you must create an account and provide accurate, complete and current information. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account.',
      'Professionals and firms must complete our verification process before offering consultations. We reserve the right to suspend or terminate accounts that provide false information or breach these terms.',
    ],
  },
  {
    title: 'Consultations and payments',
    body: [
      'Profirmo enables clients to book online consultations with professionals on a pay-per-minute basis. The applicable rate is displayed on each professional profile before booking.',
      'Clients are billed for the actual duration of each consultation. Estimated costs shown at booking are indicative and the final amount is calculated on the consultation length. All payments are processed through our supported payment partners.',
    ],
  },
  {
    title: 'Professional responsibilities',
    body: [
      'Professionals and firms are solely responsible for the advice and services they provide. They must hold and maintain all qualifications, registrations and licences required to practise.',
      'Profirmo is a technology platform that facilitates connections between clients and professionals. It does not provide legal or tax advice and is not a party to the professional relationship formed between a client and a professional.',
    ],
  },
  {
    title: 'Client responsibilities',
    body: [
      'Clients agree to use the Platform lawfully and to provide accurate information relevant to their consultation. Clients are responsible for evaluating the suitability of any professional before engaging them.',
      'Any documents or information shared during a consultation must be lawfully held by the client and shared in good faith.',
    ],
  },
  {
    title: 'Cancellations and refunds',
    body: [
      'Scheduled consultations may be cancelled or rescheduled in accordance with the cancellation window shown at the time of booking. Refunds, where applicable, are processed to the original payment method.',
      'If a consultation cannot be completed due to a technical fault attributable to the Platform, we will work with you to reschedule or refund the affected amount.',
    ],
  },
  {
    title: 'Acceptable use',
    body: [
      'You agree not to misuse the Platform, including by attempting to gain unauthorised access, disrupting its operation, transmitting harmful code, or using it for any unlawful purpose.',
      'You may not circumvent the Platform to arrange or take payment for consultations outside of Profirmo.',
    ],
  },
  {
    title: 'Limitation of liability',
    body: [
      'The Platform is provided on an "as is" and "as available" basis. To the maximum extent permitted by law, Profirmo disclaims all warranties and is not liable for any indirect, incidental or consequential damages arising from your use of the Platform.',
      'Profirmo is not responsible for the accuracy, quality or outcome of any advice provided by professionals through the Platform.',
    ],
  },
  {
    title: 'Intellectual property',
    body: [
      'All content, trademarks, logos and software on the Platform are the property of Profirmo or its licensors and are protected by applicable intellectual property laws. You may not copy, reproduce or distribute them without prior written permission.',
    ],
  },
  {
    title: 'Changes to these terms',
    body: [
      'We may update these Terms & Conditions from time to time. Material changes will be communicated through the Platform. Your continued use of Profirmo after changes take effect constitutes acceptance of the revised terms.',
    ],
  },
  {
    title: 'Contact us',
    body: [
      'If you have any questions about these Terms & Conditions, please contact us at support@profirmo.in.',
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Page header */}
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Terms &amp; Conditions
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
              Please read these terms carefully before using the Profirmo
              platform.
            </p>
            <p className="mt-4 text-sm text-slate-500">
              Last updated: 21 May 2026
            </p>
          </div>
        </section>

        <section className="bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <p className="text-base text-slate-600">
              These Terms &amp; Conditions govern your access to and use of
              Profirmo. They form a legally binding agreement between you and
              Profirmo. The text below is provided as a placeholder for
              demonstration purposes.
            </p>
            <div className="mt-10 space-y-10">
              {SECTIONS.map((section, index) => (
                <div key={section.title}>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {index + 1}. {section.title}
                  </h2>
                  <div className="mt-3 space-y-3">
                    {section.body.map((paragraph, i) => (
                      <p key={i} className="text-sm leading-relaxed text-slate-600">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
