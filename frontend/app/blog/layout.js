import JsonLd, { breadcrumb, webPage, SITE_URL } from '@/components/seo/JsonLd';

const title = 'Pro Firmo Blog';
const description =
  'Notes from India’s legal & tax frontline — how-to guides, regulatory updates, and lessons from cases on the Pro Firmo platform.';

export const metadata = {
  title,
  description,
  alternates: { canonical: '/blog' },
  openGraph: {
    title: `${title}`,
    description,
    url: '/blog',
    siteName: 'Pro Firmo',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title, description },
};

const JSON_LD = [
  webPage({
    url: '/blog',
    name: title,
    description,
    type: 'CollectionPage',
  }),
  breadcrumb([
    { name: 'Home', url: '/' },
    { name: 'Blog', url: '/blog' },
  ]),
  {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${SITE_URL}/blog#blog`,
    url: `${SITE_URL}/blog`,
    name: title,
    description,
    publisher: { '@id': `${SITE_URL}#organization` },
    inLanguage: 'en-IN',
  },
];

export default function BlogLayout({ children }) {
  return (
    <>
      <JsonLd data={JSON_LD} />
      {children}
    </>
  );
}
