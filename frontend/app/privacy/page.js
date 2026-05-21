import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';

export const metadata = {
  title: 'Privacy Policy — Profirmo',
  description:
    'How Profirmo collects, uses and protects your personal information.',
};

const SECTIONS = [
  {
    title: 'Introduction',
    body: [
      'This Privacy Policy explains how Profirmo ("we", "us") collects, uses, shares and protects your personal information when you use our platform. We are committed to handling your data responsibly and transparently.',
      'By using Profirmo, you consent to the practices described in this policy.',
    ],
  },
  {
    title: 'Data we collect',
    body: [
      'Account information: your name, email address, phone number, city and account type when you register as a client, professional or firm.',
      'Professional details: for professionals and firms, this includes specialization, experience, registration numbers, services offered and availability.',
      'Usage and consultation data: bookings, consultation history, reviews, messages and documents you upload to support a consultation.',
      'Technical data: device information, browser type, IP address and cookies used to operate and improve the Platform.',
    ],
  },
  {
    title: 'How we use your information',
    body: [
      'To create and manage your account, verify professionals, and operate the Platform.',
      'To facilitate bookings, consultations and payments between clients and professionals.',
      'To communicate with you about your account, bookings and important service updates.',
      'To improve the Platform, personalise your experience, prevent fraud and ensure security.',
    ],
  },
  {
    title: 'Sharing your information',
    body: [
      'We share information between clients and professionals only as needed to deliver a consultation you have booked.',
      'We may share data with trusted service providers — such as payment processors and hosting providers — who process it on our behalf under strict confidentiality obligations.',
      'We may disclose information where required by law, regulation or legal process, or to protect the rights and safety of our users. We do not sell your personal information.',
    ],
  },
  {
    title: 'Data security',
    body: [
      'We use appropriate technical and organisational measures to protect your personal information against unauthorised access, loss or misuse, including encryption in transit and access controls.',
      'While we work hard to safeguard your data, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.',
    ],
  },
  {
    title: 'Data retention',
    body: [
      'We retain personal information for as long as your account is active or as needed to provide our services, comply with legal obligations, resolve disputes and enforce our agreements.',
    ],
  },
  {
    title: 'Your rights',
    body: [
      'You may access, update or correct your account information at any time through your dashboard.',
      'You may request a copy of your personal data, ask us to delete it, or object to certain processing, subject to applicable law and our legal obligations.',
      'To exercise any of these rights, please contact us using the details below.',
    ],
  },
  {
    title: 'Cookies',
    body: [
      'We use cookies and similar technologies to keep you signed in, remember your preferences and understand how the Platform is used. You can manage cookies through your browser settings.',
    ],
  },
  {
    title: 'Changes to this policy',
    body: [
      'We may update this Privacy Policy from time to time. Material changes will be communicated through the Platform. Please review this page periodically to stay informed.',
    ],
  },
  {
    title: 'Contact us',
    body: [
      'If you have questions about this Privacy Policy or how we handle your data, please contact us at privacy@profirmo.in.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Page header */}
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Privacy Policy
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
              Your privacy matters to us. This policy explains what data we
              collect and how we use it.
            </p>
            <p className="mt-4 text-sm text-slate-500">
              Last updated: 21 May 2026
            </p>
          </div>
        </section>

        <section className="bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <p className="text-base text-slate-600">
              At Profirmo, we are committed to protecting your personal
              information. The text below is provided as a placeholder for
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
