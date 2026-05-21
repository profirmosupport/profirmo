const title = 'Find Legal & Tax Professionals';
const description =
  'Browse and compare verified advocates, lawyers and tax consultants on Pro Firmo. Filter by specialization, city, experience, rating and per-minute rate.';

export const metadata = {
  title,
  description,
  alternates: { canonical: '/professionals' },
  openGraph: { title: `${title} | Pro Firmo`, description, url: '/professionals' },
  twitter: { title: `${title} | Pro Firmo`, description },
};

export default function ProfessionalsLayout({ children }) {
  return children;
}
