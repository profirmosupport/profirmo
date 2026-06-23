import JsonLd, { breadcrumb, webPage } from '@/components/seo/JsonLd';

const title = 'Privacy Policy';
const description =
  'Read the Pro Firmo privacy policy to understand how we collect, use and protect your personal information.';

export const metadata = {
  title,
  description,
  keywords: [
    'Pro Firmo privacy policy',
    'data protection',
    'user privacy',
    'personal information policy',
    'data collection policy',
  ],
  alternates: { canonical: '/privacy' },
  openGraph: { title: `${title} | Pro Firmo`, description, url: '/privacy' },
  twitter: { title: `${title} | Pro Firmo`, description },
};

const JSON_LD = [
  webPage({
    url: '/privacy',
    name: `${title} | Pro Firmo`,
    description,
  }),
  breadcrumb([
    { name: 'Home', url: '/' },
    { name: 'Privacy', url: '/privacy' },
  ]),
];

export default function PrivacyLayout({ children }) {
  return (
    <>
      <JsonLd data={JSON_LD} />
      {children}
    </>
  );
}
