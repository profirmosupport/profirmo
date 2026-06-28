import JsonLd, { breadcrumb, webPage } from '@/components/seo/JsonLd';

const title = 'How It Works';
const description =
  'Discover how Pro Firmo uses AI to understand your case and match you with the right verified legal or tax professional in minutes.';

export const metadata = {
  title,
  description,
  keywords: [
    'How Pro Firmo works',
    'AI legal matching',
    'AI tax matching',
    'online legal consultation process',
    'find a lawyer online',
    'find a tax consultant online',
    'verified professionals',
  ],
  alternates: { canonical: '/how-it-works' },
  openGraph: { title: `${title} | Pro Firmo`, description, url: '/how-it-works' },
  twitter: { title: `${title} | Pro Firmo`, description },
};

const JSON_LD = [
  webPage({
    url: '/how-it-works',
    name: `${title} | Pro Firmo`,
    description,
  }),
  breadcrumb([
    { name: 'Home', url: '/' },
    { name: 'How it works', url: '/how-it-works' },
  ]),
  {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to get expert legal or tax help on Pro Firmo',
    description,
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Explain your case to AI',
        text: 'Type or speak your issue. The AI assistant asks clarifying questions and identifies the right kind of expert.',
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Match with a verified expert',
        text: 'Pro Firmo surfaces verified lawyers, advocates or tax consultants matched to your case and location.',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Consult and resolve',
        text: 'Book a video, phone or in-person consultation, track every update, and pay only for what you use.',
      },
    ],
  },
];

export default function HowItWorksLayout({ children }) {
  return (
    <>
      <JsonLd data={JSON_LD} />
      {children}
    </>
  );
}
