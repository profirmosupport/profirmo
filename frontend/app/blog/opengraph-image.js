// OG image for /blog (the index). Per-post images can be added later
// alongside each [slug] route as posts go live.

import renderOgImage, {
  OG_SIZE,
  OG_CONTENT_TYPE,
} from '@/lib/og/template.jsx';

export const runtime = 'edge';
export const alt = 'Pro Firmo blog — perspectives on Indian legal & tax practice';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function BlogOgImage() {
  return renderOgImage({
    eyebrow: 'Blog',
    title: 'Notes from India’s legal & tax frontline.',
    tagline:
      'How-to guides, regulatory updates, and lessons from cases on the Pro Firmo platform.',
    iconName: 'Newspaper',
    accent: 'indigo',
  });
}
