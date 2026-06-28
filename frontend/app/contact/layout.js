import JsonLd, { breadcrumb, webPage, SITE_URL } from '@/components/seo/JsonLd';

const title = 'Contact Us';
const description =
  'Get in touch with the Pro Firmo team for support, partnership enquiries or questions about AI-powered legal and tax consultations.';

export const metadata = {
  title,
  description,
  keywords: [
    'Contact Pro Firmo',
    'Pro Firmo support',
    'legal consultation help',
    'tax consultation help',
    'partnership enquiries',
    'customer support',
  ],
  alternates: { canonical: '/contact' },
  openGraph: { title: `${title} | Pro Firmo`, description, url: '/contact' },
  twitter: { title: `${title} | Pro Firmo`, description },
};

const JSON_LD = [
  webPage({
    url: '/contact',
    name: `${title} | Pro Firmo`,
    description,
    type: 'ContactPage',
  }),
  breadcrumb([
    { name: 'Home', url: '/' },
    { name: 'Contact', url: '/contact' },
  ]),
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}#organization`,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'support@profirmo.com',
        areaServed: 'IN',
        availableLanguage: ['en', 'hi'],
      },
    ],
  },
];

export default function ContactLayout({ children }) {
  return (
    <>
      <JsonLd data={JSON_LD} />
      {children}
    </>
  );
}
