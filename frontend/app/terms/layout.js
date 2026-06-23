import JsonLd, { breadcrumb, webPage } from '@/components/seo/JsonLd';

const title = 'Terms & Conditions';
const description =
  'Read the terms and conditions governing the use of the Pro Firmo platform and its consultation services.';

export const metadata = {
  title,
  description,
  keywords: [
    'Pro Firmo terms',
    'terms and conditions',
    'platform terms of service',
    'consultation service terms',
    'user agreement',
  ],
  alternates: { canonical: '/terms' },
  openGraph: { title: `${title} | Pro Firmo`, description, url: '/terms' },
  twitter: { title: `${title} | Pro Firmo`, description },
};

const JSON_LD = [
  webPage({
    url: '/terms',
    name: `${title} | Pro Firmo`,
    description,
  }),
  breadcrumb([
    { name: 'Home', url: '/' },
    { name: 'Terms', url: '/terms' },
  ]),
];

export default function TermsLayout({ children }) {
  return (
    <>
      <JsonLd data={JSON_LD} />
      {children}
    </>
  );
}
