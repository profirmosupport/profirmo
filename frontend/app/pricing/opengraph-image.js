// OG image for /pricing.

import renderOgImage, {
  OG_SIZE,
  OG_CONTENT_TYPE,
} from '@/lib/og/template.jsx';

export const runtime = 'edge';
export const alt = 'Pro Firmo pricing — transparent, no hidden fees';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function PricingOgImage() {
  return renderOgImage({
    eyebrow: 'Pricing',
    title: 'Transparent pricing. No hidden fees.',
    tagline:
      'Pay per consultation or pick a plan that scales with your practice. Quotes upfront, every time.',
    iconName: 'CreditCard',
    accent: 'amber',
  });
}
