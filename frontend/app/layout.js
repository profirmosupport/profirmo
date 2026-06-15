import './globals.css';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import { LanguageProvider } from '@/components/LanguageProvider';
import { AuthProvider } from '@/components/AuthProvider';

const GA_MEASUREMENT_ID = 'G-K1LJGC40Y6';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Layered fallback — see notes in app/blog/[slug]/page.js. Without this,
// relative URLs in any page's metadata get resolved against `localhost:3000`
// when the build env didn't set NEXT_PUBLIC_SITE_URL.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://profirmo.com'
    : 'http://localhost:3000');

const TITLE = 'Pro Firmo | AI-Powered Legal & Tax Consultation Platform';
const DESCRIPTION =
  'Pro Firmo lets you explain your case to AI first, then instantly matches you with the most suitable verified lawyer, advocate, tax expert or professional firm.';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s | Pro Firmo',
  },
  description: DESCRIPTION,
  applicationName: 'Pro Firmo',
  keywords: [
    'Pro Firmo',
    'legal consultation',
    'tax consultation',
    'online lawyer',
    'advocate',
    'tax consultant',
    'GST consultant',
    'income tax consultant',
    'legal advice online',
    'AI lawyer matching',
    'professional consultation',
    'company registration',
    'legal firm',
    'tax advisory firm',
  ],
  authors: [{ name: 'Pro Firmo' }],
  creator: 'Pro Firmo',
  publisher: 'Pro Firmo',
  category: 'Legal & Tax Services',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Pro Firmo',
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport = {
  themeColor: '#d97706',
  width: 'device-width',
  initialScale: 1,
};

// Site-wide JSON-LD. Two graphs: Organization (the brand) + WebSite
// (with a SearchAction so Google can render the sitelinks search box, and
// so AI assistants understand how to query us). Kept in this layout so it
// renders on every page.
const SITE_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}#organization`,
      name: 'Pro Firmo',
      alternateName: 'Profirmo',
      url: SITE_URL,
      logo: `${SITE_URL}/logos/profirmo-512.png`,
      description: DESCRIPTION,
      foundingDate: '2024',
      areaServed: { '@type': 'Country', name: 'India' },
      knowsAbout: [
        'Legal consultation',
        'Tax consultation',
        'GST advisory',
        'Income tax filing',
        'Company registration',
        'Property law',
        'Family law',
        'Corporate law',
      ],
      sameAs: [
        'https://www.linkedin.com/company/pro-firmo/',
        'https://www.facebook.com/fbprofirmo',
        'https://www.instagram.com/profirmoinsta/',
      ],
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
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      url: SITE_URL,
      name: 'Pro Firmo',
      description: DESCRIPTION,
      inLanguage: 'en-IN',
      publisher: { '@id': `${SITE_URL}#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Cheap perf hints — open TLS to the third-party origins we know
            we'll hit so the browser doesn't pay DNS+TLS RTT on first use. */}
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.google-analytics.com" />
        <link rel="dns-prefetch" href="https://i.pravatar.cc" />
        <link rel="dns-prefetch" href="https://picsum.photos" />
        <link rel="dns-prefetch" href="https://ui-avatars.com" />
        {/* Site-wide structured data — read by Google, Bing, and the AI
            assistants (ChatGPT/Gemini/Claude/Perplexity) to understand
            what the site is and how to cite it. */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_LD) }}
        />
      </head>
      <body className="font-sans">
        {/* Google Analytics (gtag.js) — loaded after page becomes interactive
            so it never blocks the initial render. */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <LanguageProvider>
          <AuthProvider>{children}</AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
