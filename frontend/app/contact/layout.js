const title = 'Contact Us';
const description =
  'Get in touch with the Pro Firmo team for support, partnership enquiries or questions about AI-powered legal and tax consultations.';

export const metadata = {
  title,
  description,
  alternates: { canonical: '/contact' },
  openGraph: { title: `${title} | Pro Firmo`, description, url: '/contact' },
  twitter: { title: `${title} | Pro Firmo`, description },
};

export default function ContactLayout({ children }) {
  return children;
}
