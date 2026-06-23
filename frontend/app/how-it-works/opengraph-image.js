// OG image for /how-it-works.

import renderOgImage, {
  OG_SIZE,
  OG_CONTENT_TYPE,
} from '@/lib/og/template.jsx';

export const runtime = 'edge';
export const alt = 'How Pro Firmo works — explain, match, resolve';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function HowItWorksOgImage() {
  return renderOgImage({
    eyebrow: 'How it works',
    title: 'Explain. Match. Resolve.',
    tagline:
      'Three steps from a confused user to a verified expert holding your hand through the next move.',
    iconName: 'Workflow',
    accent: 'violet',
  });
}
