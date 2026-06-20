/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  eslint: {
    // Lint is available via `npm run lint`; do not block production builds on it.
    ignoreDuringBuilds: true,
  },

  // Critical-CSS extraction. `optimizeCss` runs `critters` over each route's
  // HTML output during build, inlining the CSS rules actually used above the
  // fold and deferring the rest. This cuts the render-blocking CSS payload
  // that PageSpeed flags as "Eliminate render-blocking resources" — most of
  // our globals.css (~80 KB compiled Tailwind) is unused per page.
  // Requires `critters` to be installed in devDependencies.
  experimental: {
    optimizeCss: true,
  },

  // Long cache headers for static assets in /public/. Render's default for
  // public files is `max-age=5`, which forces every visitor to re-fetch
  // images / logos / videos on every page load and PSI flags it as
  // "Use efficient cache lifetimes". One year cache (no `immutable`) lets
  // browsers revalidate via etag/last-modified when we actually update an
  // asset; for routine page loads they hit the local cache.
  async headers() {
    const oneYear = 'public, max-age=31536000';
    return [
      {
        source:
          '/:path*.(png|jpg|jpeg|gif|webp|avif|svg|ico|mp4|webm|woff|woff2|otf|ttf|pdf)',
        headers: [{ key: 'Cache-Control', value: oneYear }],
      },
      {
        // llms.txt is roughly static — 30 days is a fair middle ground.
        source: '/llms.txt',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000' },
        ],
      },
    ];
  },
};
