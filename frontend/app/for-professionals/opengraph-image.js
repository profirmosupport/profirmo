// OG image for /for-professionals.

import renderOgImage, {
  OG_SIZE,
  OG_CONTENT_TYPE,
} from '@/lib/og/template.jsx';

export const runtime = 'edge';
export const alt = 'Pro Firmo for professionals — grow your practice with AI';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function ForProfessionalsOgImage() {
  return renderOgImage({
    eyebrow: 'For Professionals',
    title: 'Grow your practice with AI-matched clients.',
    tagline:
      'Lawyers, advocates, CAs & consultants — get pre-qualified cases, manage them end-to-end, and get paid on time.',
    iconName: 'Briefcase',
    accent: 'rose',
  });
}
