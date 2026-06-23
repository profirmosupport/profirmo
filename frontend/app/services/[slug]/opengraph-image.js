// OG image for every /services/<slug> landing. Driven by
// data/serviceLandings.js so the icon + accent + tagline match the
// page hero exactly.

import { notFound } from 'next/navigation';
import renderOgImage, {
  OG_SIZE,
  OG_CONTENT_TYPE,
} from '@/lib/og/template.jsx';
import { SERVICE_LANDINGS } from '@/data/serviceLandings';

// generateStaticParams requires the Node runtime — Next refuses to
// pair it with the edge runtime. The Node runtime is also fine here:
// the OG template doesn't use any edge-only APIs.
export const alt = 'Pro Firmo service';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return SERVICE_LANDINGS.map((s) => ({ slug: s.slug }));
}

export default async function ServiceSlugOgImage({ params }) {
  const { slug } = await params;
  const s = SERVICE_LANDINGS.find((x) => x.slug === slug);
  if (!s) return notFound();
  return renderOgImage({
    eyebrow: s.eyebrow || 'Service',
    title: s.ogTitle || s.title,
    tagline: s.ogSubtitle || s.subtitle,
    iconName: s.icon,
    accent: s.accent,
  });
}
