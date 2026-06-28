// OG image for /resources.

import renderOgImage, {
  OG_SIZE,
  OG_CONTENT_TYPE,
} from '@/lib/og/template.jsx';

export const runtime = 'edge';
export const alt = 'Pro Firmo resources — guides, templates, calculators';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function ResourcesOgImage() {
  return renderOgImage({
    eyebrow: 'Resources',
    title: 'Guides, templates & calculators.',
    tagline:
      'Plain-English explainers for India’s legal and tax workflows — written by experts, free to use.',
    iconName: 'BookOpen',
    accent: 'teal',
  });
}
