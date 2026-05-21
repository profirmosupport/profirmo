const title = 'How It Works';
const description =
  'Discover how Pro Firmo uses AI to understand your case and match you with the right verified legal or tax professional in minutes.';

export const metadata = {
  title,
  description,
  alternates: { canonical: '/how-it-works' },
  openGraph: { title: `${title} | Pro Firmo`, description, url: '/how-it-works' },
  twitter: { title: `${title} | Pro Firmo`, description },
};

export default function HowItWorksLayout({ children }) {
  return children;
}
