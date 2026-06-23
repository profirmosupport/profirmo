// JsonLd — emits an `application/ld+json` script tag for one or more
// schema.org graphs. Renders in the document body (React 18+ moves
// inline scripts into <head> automatically when placed before any
// hydration roots, which is fine for SEO crawlers).
//
// Usage:
//   <JsonLd data={{ "@context": "https://schema.org", ... }} />
// or
//   <JsonLd data={[graphA, graphB]} />

import React from 'react';

function serialise(data) {
  // Strip undefined values so the emitted JSON stays compact. Google's
  // rich-result validator silently drops keys with undefined values,
  // but a smaller payload is better for crawl budget.
  return JSON.stringify(data, (_, v) => (v === undefined ? undefined : v));
}

export default function JsonLd({ data, id }) {
  if (!data) return null;
  const list = Array.isArray(data) ? data : [data];
  return list.map((node, i) => (
    <script
      key={id ? `${id}-${i}` : i}
      type="application/ld+json"
      // dangerouslySetInnerHTML is the React-sanctioned way to inject
      // a raw <script> body. We control the input (server-side from
      // page metadata) so XSS isn't a concern here.
      dangerouslySetInnerHTML={{ __html: serialise(node) }}
    />
  ));
}

// Shared building blocks reused across pages.
export const SITE_URL = 'https://profirmo.com';
export const ORG_REF = { '@id': `${SITE_URL}#organization` };

/** Standard breadcrumb graph builder for a single page. */
export function breadcrumb(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url.startsWith('http') ? it.url : `${SITE_URL}${it.url}`,
    })),
  };
}

/** A WebPage node anchored to the site's Organization. */
export function webPage({ url, name, description, type = 'WebPage' }) {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    '@id': `${SITE_URL}${url}#webpage`,
    url: `${SITE_URL}${url}`,
    name,
    description,
    isPartOf: { '@id': `${SITE_URL}#website` },
    publisher: ORG_REF,
    inLanguage: 'en-IN',
  };
}
