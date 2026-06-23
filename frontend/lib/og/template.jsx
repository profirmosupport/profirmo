/* eslint-disable @next/next/no-img-element */
// Shared OG image template — one branded 1200×630 illustration for
// every CMS page. The accent gradient + icon are page-specific; the
// right-hand brand panel stays constant so social shares look like a
// coherent set.
//
// Build by composing an ImageResponse around `<OgFrame>` inside any
// `opengraph-image.js` route segment. See the existing opengraph-image
// files for examples.

import { ImageResponse } from 'next/og';
import ICONS from './icons.jsx';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

// Per-accent gradient stops (mirrors tailwind 500→700 ramps used in the
// dashboard). Falls back to amber when an unknown accent is passed.
const ACCENT_GRADIENT = {
  amber: ['#f59e0b', '#b45309'],
  teal: ['#14b8a6', '#0f766e'],
  indigo: ['#6366f1', '#4338ca'],
  rose: ['#f43f5e', '#be123c'],
  violet: ['#8b5cf6', '#6d28d9'],
  emerald: ['#10b981', '#047857'],
  sky: ['#0ea5e9', '#0369a1'],
  slate: ['#64748b', '#1e293b'],
};

function gradientFor(accent) {
  const [a, b] = ACCENT_GRADIENT[accent] || ACCENT_GRADIENT.amber;
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/**
 * OgFrame — the shared 1200×630 layout.
 *
 * Props:
 *   - title    (string, required)  — big bold headline on the panel
 *   - tagline  (string)            — one-line subtext under the title
 *   - eyebrow  (string)            — small uppercase pill above the title
 *   - iconName (string)            — key into lib/og/icons.jsx
 *   - accent   (string)            — key into ACCENT_GRADIENT
 */
function OgFrame({ title, tagline = '', eyebrow = '', iconName, accent = 'amber' }) {
  const Icon = (iconName && ICONS[iconName]) || ICONS.Scale;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
      }}
    >
      {/* Left — coloured illustration panel */}
      <div
        style={{
          width: 720,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 56px 56px 64px',
          color: '#fff',
          background: gradientFor(accent),
          position: 'relative',
        }}
      >
        {/* Decorative orbs to add depth without competing with the text */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -80,
            width: 320,
            height: 320,
            borderRadius: 9999,
            background: 'rgba(255,255,255,0.10)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -160,
            left: -120,
            width: 400,
            height: 400,
            borderRadius: 9999,
            background: 'rgba(255,255,255,0.08)',
          }}
        />

        {/* Icon tile */}
        <div
          style={{
            display: 'flex',
            width: 136,
            height: 136,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 28,
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.30)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <Icon size={84} color="#ffffff" strokeWidth={1.6} />
        </div>

        {/* Title block */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {eyebrow ? (
            <div
              style={{
                alignSelf: 'flex-start',
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: 'uppercase',
                padding: '6px 14px',
                borderRadius: 9999,
                background: 'rgba(255,255,255,0.20)',
                border: '1px solid rgba(255,255,255,0.35)',
              }}
            >
              {eyebrow}
            </div>
          ) : null}
          <div
            style={{
              fontSize: title && title.length > 40 ? 56 : 64,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1,
              textShadow: '0 2px 12px rgba(0,0,0,0.18)',
              maxWidth: 600,
              display: 'flex',
            }}
          >
            {title}
          </div>
          {tagline ? (
            <div
              style={{
                fontSize: 26,
                lineHeight: 1.35,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.92)',
                maxWidth: 600,
                display: 'flex',
              }}
            >
              {tagline}
            </div>
          ) : null}
        </div>
      </div>

      {/* Right — brand panel */}
      <div
        style={{
          width: 480,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 56px 56px 56px',
          background: '#fffbeb', // amber-50
          color: '#1f2937',
        }}
      >
        {/* Brand wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 16,
              background:
                'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#fff',
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: -1,
            }}
          >
            P
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: '#1f2937',
                letterSpacing: -0.5,
                lineHeight: 1,
              }}
            >
              Pro Firmo
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 14,
                color: '#a16207',
                fontWeight: 700,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
              }}
            >
              Legal · Tax · Compliance
            </div>
          </div>
        </div>

        {/* Promise block */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#92400e',
              lineHeight: 1.3,
              display: 'flex',
            }}
          >
            AI-powered platform for
            <br />
            India&apos;s legal &amp; tax needs.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              'Explain your case to AI first',
              'Match with verified experts',
              'Track every step end-to-end',
            ].map((bullet) => (
              <div
                key={bullet}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 16,
                  color: '#374151',
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 9999,
                    background: '#d97706',
                  }}
                />
                <span style={{ display: 'flex' }}>{bullet}</span>
              </div>
            ))}
          </div>
        </div>

        {/* URL strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 18,
            fontWeight: 600,
            color: '#b45309',
            letterSpacing: 0.5,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 9999,
              background: '#10b981',
            }}
          />
          profirmo.com
        </div>
      </div>
    </div>
  );
}

/**
 * renderOgImage — convenience wrapper that returns the ImageResponse
 * directly. Each opengraph-image.js exports an async default that
 * calls this with its page's content.
 */
export default function renderOgImage(props) {
  return new ImageResponse(<OgFrame {...props} />, OG_SIZE);
}
