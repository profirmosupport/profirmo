// OG image for /privacy.

import renderOgImage, {
  OG_SIZE,
  OG_CONTENT_TYPE,
} from '@/lib/og/template.jsx';

export const runtime = 'edge';
export const alt = 'Pro Firmo Privacy Policy';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function PrivacyOgImage() {
  return renderOgImage({
    eyebrow: 'Privacy',
    title: 'Your data, treated with care.',
    tagline:
      'How Pro Firmo collects, uses and protects your information across every consultation.',
    iconName: 'Shield',
    accent: 'emerald',
  });
}
