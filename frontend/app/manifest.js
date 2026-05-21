export default function manifest() {
  return {
    name: 'Pro Firmo — AI-Powered Legal & Tax Consultation',
    short_name: 'Pro Firmo',
    description:
      'Explain your case to AI and get matched with the right verified legal or tax professional.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fafaf9',
    theme_color: '#d97706',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
