// OG image for /services — branded illustration with a "Services" icon
// + listing eyebrow. Re-uses the shared OgFrame so visiting URLs share
// a consistent visual language on social.

import renderOgImage, {
  OG_SIZE,
  OG_CONTENT_TYPE,
} from '@/lib/og/template.jsx';

export const runtime = 'edge';
export const alt = 'Pro Firmo — every legal & tax service in one place';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function ServicesOgImage() {
  return renderOgImage({
    eyebrow: 'Services',
    title: 'Every legal & tax service in one place.',
    tagline:
      'Property, GST, ITR, divorce, cheque-bounce, startups, ROC, IP, NRI — AI-matched to verified experts in minutes.',
    iconName: 'Scale',
    accent: 'amber',
  });
}
