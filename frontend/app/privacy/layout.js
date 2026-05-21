const title = 'Privacy Policy';
const description =
  'Read the Pro Firmo privacy policy to understand how we collect, use and protect your personal information.';

export const metadata = {
  title,
  description,
  alternates: { canonical: '/privacy' },
  openGraph: { title: `${title} | Pro Firmo`, description, url: '/privacy' },
  twitter: { title: `${title} | Pro Firmo`, description },
};

export default function PrivacyLayout({ children }) {
  return children;
}
