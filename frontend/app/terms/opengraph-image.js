// OG image for /terms.

import renderOgImage, {
  OG_SIZE,
  OG_CONTENT_TYPE,
} from '@/lib/og/template.jsx';

export const runtime = 'edge';
export const alt = 'Pro Firmo Terms & Conditions';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function TermsOgImage() {
  return renderOgImage({
    eyebrow: 'Legal',
    title: 'Terms & conditions of using Pro Firmo.',
    tagline:
      'The user agreement that governs consultations and other services on this platform.',
    iconName: 'ScrollText',
    accent: 'slate',
  });
}
