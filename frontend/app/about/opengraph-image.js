// OG image for /about.

import renderOgImage, {
  OG_SIZE,
  OG_CONTENT_TYPE,
} from '@/lib/og/template.jsx';

export const runtime = 'edge';
export const alt = 'About Pro Firmo — AI + verified experts for legal & tax help';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function AboutOgImage() {
  return renderOgImage({
    eyebrow: 'About',
    title: 'AI + verified experts, working together for you.',
    tagline:
      'Explain your case to AI, then meet a real lawyer or tax consultant matched to it.',
    iconName: 'Info',
    accent: 'indigo',
  });
}
