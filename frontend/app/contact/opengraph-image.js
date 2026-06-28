// OG image for /contact.

import renderOgImage, {
  OG_SIZE,
  OG_CONTENT_TYPE,
} from '@/lib/og/template.jsx';

export const runtime = 'edge';
export const alt = 'Contact Pro Firmo — support, partnerships & enquiries';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function ContactOgImage() {
  return renderOgImage({
    eyebrow: 'Contact',
    title: "We're here to help.",
    tagline:
      'Reach the Pro Firmo team for support, partnerships, or questions about your case.',
    iconName: 'Phone',
    accent: 'teal',
  });
}
