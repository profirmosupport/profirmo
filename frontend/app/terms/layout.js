const title = 'Terms & Conditions';
const description =
  'Read the terms and conditions governing the use of the Pro Firmo platform and its consultation services.';

export const metadata = {
  title,
  description,
  alternates: { canonical: '/terms' },
  openGraph: { title: `${title} | Pro Firmo`, description, url: '/terms' },
  twitter: { title: `${title} | Pro Firmo`, description },
};

export default function TermsLayout({ children }) {
  return children;
}
