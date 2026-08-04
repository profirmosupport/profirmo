// Metadata for the /consult lead-funnel landing page.
//
// noindex: this is a paid-campaign landing page, not organic content —
// keeping it out of the search index avoids thin/duplicate-content flags
// and keeps it scoped to ad traffic. Flip `robots` to index/follow if you
// ever want it discoverable organically.

const title = 'Talk to Firmo — legal & tax matters, made simple';
const description =
  'Share a few details, verify your mobile number, and connect with verified, independent professionals for your legal or tax matter — private and with no obligation.';

export const metadata = {
  title,
  description,
  alternates: { canonical: '/consult' },
  robots: { index: false, follow: true },
  openGraph: {
    title: `${title} | Pro Firmo`,
    description,
    url: '/consult',
    type: 'website',
    siteName: 'Pro Firmo',
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function ConsultLayout({ children }) {
  return children;
}
