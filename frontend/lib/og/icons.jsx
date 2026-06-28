/**
 * Inline SVG path data for the lucide icons used across the OG-image
 * template. Lucide's React components don't always behave inside
 * Next's edge-runtime ImageResponse, so we render the raw SVG here
 * with hard-coded path data.
 *
 * Each icon is exposed as a small component accepting `{ size, color }`
 * so the OG template can swap colours per page accent.
 *
 * Source: https://lucide.dev (MIT). Copied path data verbatim — if a
 * page adds a new icon name, copy the path attributes from the
 * canonical icon page on lucide.dev and add it to ICONS below.
 */

function makeIcon(paths) {
  return function Icon({ size = 96, color = '#fff', strokeWidth = 1.75 }) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths.map((p, i) => (
          <path key={i} d={p} />
        ))}
      </svg>
    );
  };
}

// ---- service-landing icons (mirrors data/serviceLandings.js) ----
const ICONS = {
  // Receipt — GST + Income-tax
  Receipt: makeIcon([
    'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z',
    'M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8',
    'M12 17.5v-11',
  ]),
  FileText: makeIcon([
    'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
    'M14 2v4a2 2 0 0 0 2 2h4',
    'M10 9H8',
    'M16 13H8',
    'M16 17H8',
  ]),
  Building2: makeIcon([
    'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z',
    'M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2',
    'M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2',
    'M10 6h4',
    'M10 10h4',
    'M10 14h4',
    'M10 18h4',
  ]),
  Rocket: makeIcon([
    'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z',
    'M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z',
    'M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0',
    'M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5',
  ]),
  Home: makeIcon([
    'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8',
    'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  ]),
  Heart: makeIcon([
    'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z',
  ]),
  Mail: makeIcon([
    'M22 17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z',
    'm22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7',
  ]),
  AlertCircle: makeIcon([
    'M12 8v4',
    'M12 16h.01',
    'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  ]),
  ShieldCheck: makeIcon([
    'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
    'm9 12 2 2 4-4',
  ]),
  ShoppingBag: makeIcon([
    'M16 10a4 4 0 0 1-8 0',
    'M3.103 6.034h17.794',
    'M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z',
  ]),
  Briefcase: makeIcon([
    'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
    'M2 9.764a4 4 0 0 1 2-3.464l6.857-3.43a4 4 0 0 1 3.586 0L19.999 6.3a2 2 0 0 1 1.001 1.732V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V11',
  ]),
  ScrollText: makeIcon([
    'M15 8h-5',
    'M15 12H10',
    'M19 17V5a2 2 0 0 0-2-2H4',
    'M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3',
  ]),
  FileSignature: makeIcon([
    'M20 19h-13',
    'M19 7-9 17l-4 1 1-4L17 5z',
    'M14 4 18 8',
  ]),
  Globe2: makeIcon([
    'M21.54 15H17a2 2 0 0 0-2 2v4.54',
    'M7 3.34V5a3 3 0 0 0 3 3v0a2 2 0 0 1 2 2v0c0 1.1.9 2 2 2v0a2 2 0 0 0 2-2v0c0-1.1.9-2 2-2h3.17',
    'M11 21.95V18a2 2 0 0 0-2-2v0a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05',
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  ]),
  FileSearch: makeIcon([
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M11.5 12.5l3 3',
    'M9.5 14a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0z',
  ]),

  // ---- core info / utility pages ----
  Scale: makeIcon([
    'm16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z',
    'm2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z',
    'M7 21h10',
    'M12 3v18',
    'M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2',
  ]),
  Phone: makeIcon([
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
  ]),
  Info: makeIcon([
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 16v-4',
    'M12 8h.01',
  ]),
  Shield: makeIcon([
    'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
  ]),
  CreditCard: makeIcon([
    'M22 10H2',
    'M22 12V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4',
    'M16 16h2',
  ]),
  Workflow: makeIcon([
    'M3 7a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z',
    'M15 19a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2z',
    'M9 7h6a4 4 0 0 1 4 4v4',
  ]),
  BookOpen: makeIcon([
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ]),
  Newspaper: makeIcon([
    'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2',
    'M18 14h-8',
    'M15 18h-5',
    'M10 6h8v4h-8z',
  ]),
  Calculator: makeIcon([
    'M16 2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z',
    'M8 6h8',
    'M8 10h.01',
    'M12 10h.01',
    'M16 10h.01',
    'M8 14h.01',
    'M12 14h.01',
    'M16 14h.01',
    'M8 18h.01',
    'M12 18h.01',
    'M16 18h.01',
  ]),
};

export default ICONS;
