// OG image for /tools/gst-calculator.

import renderOgImage, {
  OG_SIZE,
  OG_CONTENT_TYPE,
} from '@/lib/og/template.jsx';

export const runtime = 'edge';
export const alt = 'Pro Firmo GST Calculator — split CGST + SGST + IGST instantly';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function GstCalculatorOgImage() {
  return renderOgImage({
    eyebrow: 'GST Calculator',
    title: 'CGST + SGST + IGST, split in one tap.',
    tagline:
      'Inclusive or exclusive of GST? Plug in the amount, pick the rate, and copy the breakdown.',
    iconName: 'Calculator',
    accent: 'amber',
  });
}
