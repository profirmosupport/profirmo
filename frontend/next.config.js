/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  eslint: {
    // Lint is available via `npm run lint`; do not block production builds on it.
    ignoreDuringBuilds: true,
  },
};
