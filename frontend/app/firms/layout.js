const title = 'Legal & Tax Firms';
const description =
  'Explore trusted legal and tax advisory firms on Pro Firmo and connect with their teams of verified professionals.';

export const metadata = {
  title,
  description,
  alternates: { canonical: '/firms' },
  openGraph: { title: `${title} | Pro Firmo`, description, url: '/firms' },
  twitter: { title: `${title} | Pro Firmo`, description },
};

export default function FirmsLayout({ children }) {
  return children;
}
